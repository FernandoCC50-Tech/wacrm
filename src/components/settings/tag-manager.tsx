'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Rótulo } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Tag } from '@/types';

const PRESET_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
];

export function TagManager() {
  const supabase = createClient();
  const { user, accountId, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tags, setEtiquetas] = useState<Tag[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [deleteDialogAberto, setExcluirDialogAberto] = useState(false);
  const [tagToExcluir, setTagToExcluir] = useState<Tag | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newTagNome, setNovoTagNome] = useState('');
  const [selectedCor, setSelecionaredCor] = useState(PRESET_COLORS[3].value);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchEtiquetas(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function fetchEtiquetas(userId: string) {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEtiquetas(data || []);
    } catch (err) {
      console.error('Falhou to fetch tags:', err);
      toast.error('Falhou to load tags');
    } finally {
      setLoading(false);
    }
  }

  async function handleCriar() {
    if (!newTagNome.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      setSaving(true);
      if (!user || !accountId) {
        toast.error('Not authenticated');
        return;
      }

      const { error } = await supabase
        .from('tags')
        .insert({
          user_id: user.id,
          account_id: accountId,
          name: newTagNome.trim(),
          color: selectedCor,
        });

      if (error) throw error;

      toast.success('Tag created successfully');
      setDialogAberto(false);
      setNovoTagNome('');
      setSelecionaredCor(PRESET_COLORS[3].value);
      if (user) await fetchEtiquetas(user.id);
    } catch (err) {
      console.error('Criar error:', err);
      toast.error('Falhou to create tag');
    } finally {
      setSaving(false);
    }
  }

  function confirmExcluir(tag: Tag) {
    setTagToExcluir(tag);
    setExcluirDialogAberto(true);
  }

  async function handleExcluir() {
    if (!tagToExcluir) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagToExcluir.id);

      if (error) throw error;

      toast.success('Tag deleted');
      setEtiquetas((prev) => prev.filter((t) => t.id !== tagToExcluir.id));
      setExcluirDialogAberto(false);
      setTagToExcluir(null);
    } catch (err) {
      console.error('Excluir error:', err);
      toast.error('Falhou to delete tag');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div classNome="flex items-center justify-center py-12">
        <Loader2 classNome="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div classNome="space-y-4 mt-4">
      <div classNome="flex items-center justify-between">
        <div>
          <h2 classNome="text-lg font-semibold text-white">Etiquetas</h2>
          <p classNome="text-sm text-slate-400">Organize your contacts with color-coded tags.</p>
        </div>
        <Button
          onClick={() => {
            setNovoTagNome('');
            setSelecionaredCor(PRESET_COLORS[3].value);
            setDialogAberto(true);
          }}
          classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus classNome="size-4" />
          Novo Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardContent classNome="flex flex-col items-center justify-center py-12 text-center">
            <p classNome="text-slate-400 text-sm">Nenhuma etiqueta yet.</p>
            <p classNome="text-slate-500 text-xs mt-1">Criar etiquetas to categorize your contacts.</p>
          </CardContent>
        </Card>
      ) : (
        <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardContent classNome="pt-4">
            <div classNome="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  classNome="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundCor: `${tag.color}20`,
                    color: tag.color,
                    border: `1px solid ${tag.color}40`,
                  }}
                >
                  <span
                    classNome="size-2 rounded-full"
                    style={{ backgroundCor: tag.color }}
                  />
                  {tag.name}
                  <button
                    onClick={() => confirmExcluir(tag)}
                    classNome="ml-0.5 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                  >
                    <X classNome="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Novo Tag Dialog */}
      <Dialog open={dialogAberto} onAbertoChange={setDialogAberto}>
        <DialogContent classNome="bg-slate-900 border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle classNome="text-white">Novo Tag</DialogTitle>
            <DialogDescription classNome="text-slate-400">
              Criar a new tag with a name and color.
            </DialogDescription>
          </DialogHeader>

          <div classNome="space-y-4 py-2">
            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Tag Nome</Rótulo>
              <Input
                placeholder="e.g. VIP Customer"
                value={newTagNome}
                onChange={(e) => setNovoTagNome(e.target.value)}
                classNome="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCriar();
                }}
              />
            </div>

            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Cor</Rótulo>
              <div classNome="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelecionaredCor(color.value)}
                    classNome="relative size-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900"
                    style={{
                      backgroundCor: color.value,
                      boxShadow: selectedCor === color.value ? `0 0 0 2px rgb(15 23 42), 0 0 0 4px ${color.value}` : 'none',
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div classNome="space-y-2">
              <Rótulo classNome="text-slate-300">Preview</Rótulo>
              <div>
                <span
                  classNome="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
                  style={{
                    backgroundCor: `${selectedCor}20`,
                    color: selectedCor,
                    border: `1px solid ${selectedCor}40`,
                  }}
                >
                  <span
                    classNome="size-2 rounded-full"
                    style={{ backgroundCor: selectedCor }}
                  />
                  {newTagNome || 'Tag Nome'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter classNome="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setDialogAberto(false)}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriar}
              disabled={saving}
              classNome="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Criar Tag'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir Confirmaration Dialog */}
      <Dialog open={deleteDialogAberto} onAbertoChange={setExcluirDialogAberto}>
        <DialogContent classNome="bg-slate-900 border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle classNome="text-white">Excluir Tag</DialogTitle>
            <DialogDescription classNome="text-slate-400">
              Are you sure you want to delete the tag &quot;{tagToExcluir?.name}&quot;? This will remove
              it from all contacts. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter classNome="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setExcluirDialogAberto(false)}
              classNome="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExcluir}
              disabled={deleting}
              classNome="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Excluir Tag'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
