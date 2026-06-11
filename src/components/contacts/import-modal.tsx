'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  dedupeByTelefone,
  isUniqueViolation,
  normalizeKey,
} from '@/lib/contacts/dedupe';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Enviar, FileText, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ImportarModalProps {
  open: boolean;
  onAbertoChange: (open: boolean) => void;
  onImportared: () => void;
}

interface ParsedRow {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));

  const phoneIdx = headers.indexOf('phone');
  if (phoneIdx === -1) return [];

  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');
  const companyIdx = headers.indexOf('company');

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (handles quoted fields)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const phone = values[phoneIdx]?.replace(/["']/g, '').trim();
    if (!phone) continue;

    rows.push({
      phone,
      name: nameIdx >= 0 ? values[nameIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      email: emailIdx >= 0 ? values[emailIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      company:
        companyIdx >= 0 ? values[companyIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
    });
  }

  return rows;
}

export function ImportarModal({ open, onAbertoChange, onImportared }: ImportarModalProps) {
  const supabase = createClient();
  const { accountId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImportaring] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
  } | null>(null);

  function reset() {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleAbertoChange(open: boolean) {
    if (!open) reset();
    onAbertoChange(open);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    const text = await selected.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      toast.error('No valid rows found. Ensure CSV has a "phone" column header.');
      setParsedRows([]);
      return;
    }

    setParsedRows(rows);
  }

  async function handleImportar() {
    if (parsedRows.length === 0) return;
    setImportaring(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Erro('Not authenticated');
      if (!accountId) throw new Erro('Your profile is not linked to an account.');

      let imported = 0;
      let skipped = 0;
      let failed = 0;

      // 1) De-dupe within the file by normalized phone (keep first).
      const { unique, duplicates: inFileDupes } = dedupeByTelefone(parsedRows);
      skipped += inFileDupes;

      // 2) Skip numbers already in this account. One read of the
      //    generated `phone_normalized` column (migration 022) → Set.
      const { data: existingRows } = await supabase
        .from('contacts')
        .select('phone_normalized')
        .eq('account_id', accountId);
      const existing = new Set(
        (existingRows ?? [])
          .map((r) => (r as { phone_normalized: string | null }).phone_normalized)
          .filter((p): p is string => !!p),
      );

      const toInsert = unique.filter((row) => {
        if (existing.has(normalizeKey(row.phone))) {
          skipped++;
          return false;
        }
        return true;
      });

      // 3) Batch insert the genuinely-new rows in chunks of 50. The DB
      //    unique index is the backstop: a 23505 (race, or a format
      //    that normalizes equal) counts as skipped, not failed.
      const chunkSize = 50;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const rows = chunk.map((row) => ({
          user_id: user.id,
          account_id: accountId,
          phone: row.phone,
          name: row.name || null,
          email: row.email || null,
          company: row.company || null,
        }));

        const { data, error } = await supabase
          .from('contacts')
          .insert(rows)
          .select('id');

        if (error) {
          // Retry individually so one bad/duplicate row doesn't sink
          // the whole chunk.
          for (const row of rows) {
            const { error: singleErr } = await supabase.from('contacts').insert(row);
            if (!singleErr) {
              imported++;
            } else if (isUniqueViolation(singleErr)) {
              skipped++;
            } else {
              failed++;
            }
          }
        } else {
          imported += data?.length ?? chunk.length;
        }
      }

      setResult({ imported, skipped, failed });
      if (imported > 0) {
        toast.success(`${imported} contact${imported !== 1 ? 's' : ''} imported`);
        onImportared();
      }
      if (skipped > 0) {
        toast.info(`${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped`);
      }
      if (failed > 0) {
        toast.error(`${failed} contact${failed !== 1 ? 's' : ''} failed to import`);
      }
    } catch (err: unknown) {
      const message = err instanceof Erro ? err.message : 'Importar failed';
      toast.error(message);
    } finally {
      setImportaring(false);
    }
  }

  const preview = parsedRows.slice(0, 5);

  return (
    <Dialog open={open} onAbertoChange={handleAbertoChange}>
      <DialogContent classNome="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle classNome="text-white">Importar Contatos</DialogTitle>
          <DialogDescription classNome="text-slate-400">
            Enviar a CSV file with a &quot;phone&quot; column (required). Opcional columns:
            name, email, company.
          </DialogDescription>
        </DialogHeader>

        <div classNome="space-y-4">
          {/* Enviar area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            classNome="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 p-6 cursor-pointer hover:border-primary/50 transition-colors"
          >
            {file ? (
              <>
                <FileText classNome="size-8 text-primary" />
                <p classNome="text-sm text-slate-300">{file.name}</p>
                <p classNome="text-xs text-slate-500">
                  {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} detected
                </p>
              </>
            ) : (
              <>
                <Enviar classNome="size-8 text-slate-500" />
                <p classNome="text-sm text-slate-400">
                  Click to upload CSV file
                </p>
                <p classNome="text-xs text-slate-500">
                  CSV with &quot;phone&quot; column required
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            classNome="hidden"
          />

          {/* Preview table */}
          {preview.length > 0 && !result && (
            <div classNome="space-y-2">
              <p classNome="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Preview (first {preview.length} rows)
              </p>
              <div classNome="rounded-lg border border-slate-700 overflow-hidden">
                <table classNome="w-full text-xs">
                  <thead>
                    <tr classNome="bg-slate-800">
                      <th classNome="px-3 py-1.5 text-left text-slate-400 font-medium">Telefone</th>
                      <th classNome="px-3 py-1.5 text-left text-slate-400 font-medium">Nome</th>
                      <th classNome="px-3 py-1.5 text-left text-slate-400 font-medium">E-mail</th>
                      <th classNome="px-3 py-1.5 text-left text-slate-400 font-medium">Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} classNome="border-t border-slate-700/50">
                        <td classNome="px-3 py-1.5 text-slate-300">{row.phone}</td>
                        <td classNome="px-3 py-1.5 text-slate-300">{row.name || '-'}</td>
                        <td classNome="px-3 py-1.5 text-slate-300">{row.email || '-'}</td>
                        <td classNome="px-3 py-1.5 text-slate-300">{row.company || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (
                <p classNome="text-xs text-slate-500">
                  ...and {parsedRows.length - 5} more rows
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div classNome="rounded-lg border border-slate-700 p-4 space-y-2">
              <p classNome="text-sm font-medium text-white">Importar Complete</p>
              <div classNome="flex flex-wrap items-center gap-4">
                {result.imported > 0 && (
                  <div classNome="flex items-center gap-1.5 text-primary text-sm">
                    <CheckCircle classNome="size-4" />
                    {result.imported} imported
                  </div>
                )}
                {result.skipped > 0 && (
                  <div classNome="flex items-center gap-1.5 text-amber-400 text-sm">
                    <AlertTriangle classNome="size-4" />
                    {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped
                  </div>
                )}
                {result.failed > 0 && (
                  <div classNome="flex items-center gap-1.5 text-red-400 text-sm">
                    <XCircle classNome="size-4" />
                    {result.failed} failed
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter classNome="bg-slate-900 border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleAbertoChange(false)}
            classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button
              type="button"
              disabled={parsedRows.length === 0 || importing}
              onClick={handleImportar}
              classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {importing && <Loader2 classNome="size-4 animate-spin" />}
              Importar {parsedRows.length > 0 ? `${parsedRows.length} Contatos` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
