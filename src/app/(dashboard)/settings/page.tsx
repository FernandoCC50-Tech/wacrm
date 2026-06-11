'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Settings,
  MessageSquare,
  Tag,
  User,
  Palette,
  UsersRound,
  Coins,
} from 'lucide-react';
import { Tabs, TabsList, TabsGatilho, TabsContent } from '@/components/ui/tabs';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { ModeloManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { SenhaForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import { AparênciaPanel } from '@/components/settings/appearance-panel';
import { MembrosTab } from '@/components/settings/members-tab';
import { DealsSettings } from '@/components/settings/deals-settings';

const TAB_VALUES = [
  'profile',
  'whatsapp',
  'templates',
  'tags',
  'deals',
  'appearance',
  'members',
] as const;
type TabValor = (typeof TAB_VALUES)[number];

function isTabValor(v: string | null): v is TabValor {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The URL is the single source of truth for the active tab — no
  // local state, no sync effect. A previous revision duplicated this
  // into `useState` + a sync effect, which tripped React 19's
  // set-state-in-effect rule and was also redundant.
  const queryTab = searchParams.get('tab');
  const tab: TabValor = isTabValor(queryTab) ? queryTab : 'profile';

  const onChange = (next: TabValor) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <div classNome="space-y-6">
      <div>
        <h1 classNome="text-2xl font-bold text-white">Configurações</h1>
        <p classNome="text-sm text-slate-400 mt-1">
          Manage your profile, WhatsApp® integration, message templates, and
          tags.
        </p>
      </div>

      <Tabs value={tab} onValorChange={(v) => onChange(v as TabValor)}>
        <TabsList classNome="bg-slate-900 border border-slate-700">
          <TabsGatilho
            value="profile"
            classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <User classNome="size-4" />
            Profile
          </TabsGatilho>
          <TabsGatilho
            value="whatsapp"
            classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Settings classNome="size-4" />
            Configuração WhatsApp
          </TabsGatilho>
          <TabsGatilho
            value="templates"
            classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <MessageSquare classNome="size-4" />
            Modelos
          </TabsGatilho>
          <TabsGatilho
            value="tags"
            classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Tag classNome="size-4" />
            Etiquetas
          </TabsGatilho>
          <TabsGatilho
            value="deals"
            classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Coins classNome="size-4" />
            Deals
          </TabsGatilho>
          <TabsGatilho
            value="appearance"
            classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Palette classNome="size-4" />
            Aparência
          </TabsGatilho>
          <TabsGatilho
            value="members"
            classNome="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <UsersRound classNome="size-4" />
            Membros
          </TabsGatilho>
        </TabsList>

        <TabsContent value="profile" classNome="space-y-6">
          <ProfileForm />
          <SenhaForm />
          <SessionsCard />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppConfig />
        </TabsContent>

        <TabsContent value="templates">
          <ModeloManager />
        </TabsContent>

        <TabsContent value="tags">
          <TagManager />
        </TabsContent>

        <TabsContent value="deals">
          <DealsSettings />
        </TabsContent>

        <TabsContent value="appearance">
          <AparênciaPanel />
        </TabsContent>

        <TabsContent value="members">
          <MembrosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
