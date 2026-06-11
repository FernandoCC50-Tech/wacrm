import os
import re

# Dicionário de traduções EN → PT-BR
translations = [
    # Auth
    ("Welcome back", "Bem-vindo de volta"),
    ("Sign in to your account", "Faça login na sua conta"),
    ("Sign in to accept", "Entrar para aceitar"),
    ("Sign in and we'll take you to the invitation.", "Entre e te levaremos ao convite."),
    ("Forgot password?", "Esqueceu a senha?"),
    ("Enter your password", "Digite sua senha"),
    ("Signing in...", "Entrando..."),
    ("Don&apos;t have an account?", "Não tem uma conta?"),
    ("Create account & join", "Criar conta e entrar"),
    ("Create account", "Criar conta"),
    ("Already have an account?", "Já tem uma conta?"),
    ("Check your email", "Verifique seu e-mail"),
    ("Back to sign in", "Voltar ao login"),
    ("Passwords do not match", "As senhas não coincidem"),
    ("Password must be at least 6 characters", "A senha deve ter pelo menos 6 caracteres"),
    ("Get started with CRM Template for WhatsApp", "Comece com o CRM para WhatsApp"),
    ("Verify your email, then accept the invitation to join your team.", "Verifique seu e-mail e aceite o convite para entrar no time."),
    ("Creating account...", "Criando conta..."),
    ("Full name", "Nome completo"),
    ("At least 6 characters", "Pelo menos 6 caracteres"),
    ("Repeat your password", "Repita sua senha"),
    ("Confirm password", "Confirmar senha"),
    ('"you@example.com"', '"voce@exemplo.com"'),
    ('"John Doe"', '"João Silva"'),
    ("Sign in", "Entrar"),

    # Sidebar / Nav
    ("CRM Template for WhatsApp", "CRM para WhatsApp"),
    ('"Dashboard"', '"Painel"'),
    ('"Inbox"', '"Caixa de Entrada"'),
    ('"Contacts"', '"Contatos"'),
    ('"Pipelines"', '"Funis"'),
    ('"Broadcasts"', '"Transmissões"'),
    ('"Automations"', '"Automações"'),
    ('"Flows"', '"Fluxos"'),
    ('"Settings"', '"Configurações"'),
    ("Close menu", "Fechar menu"),
    ('"Profile"', '"Perfil"'),
    ("Sign out", "Sair"),
    ('"Owner"', '"Proprietário"'),
    ('"Admin"', '"Administrador"'),
    ('"Agent"', '"Agente"'),
    ('"Viewer"', '"Visualizador"'),
    ("Beta feature", "Funcionalidade Beta"),
    ('"User"', '"Usuário"'),
    ("unread conversation", "conversa não lida"),
    ("unread conversations", "conversas não lidas"),
    ("Primary", "Principal"),

    # Settings
    (">Settings<", ">Configurações<"),
    ("Manage your profile, WhatsApp® integration, message templates, and tags.", "Gerencie seu perfil, integração com WhatsApp®, modelos de mensagens e etiquetas."),
    ("WhatsApp Config", "Configuração WhatsApp"),
    (">Templates<", ">Modelos<"),
    (">Tags<", ">Etiquetas<"),
    (">Deals<", ">Negócios<"),
    (">Appearance<", ">Aparência<"),
    (">Members<", ">Membros<"),
    (">Profile<", ">Perfil<"),

    # Dashboard
    ("Dashboard", "Painel"),
    ("Overview", "Visão Geral"),
    ("Active conversations", "Conversas ativas"),
    ("New contacts", "Novos contatos"),
    ("Open deals", "Negócios abertos"),
    ("Avg. response time", "Tempo médio de resposta"),
    ("Conversations over time", "Conversas ao longo do tempo"),
    ("Incoming", "Recebidas"),
    ("Outgoing", "Enviadas"),
    ("Activity feed", "Feed de atividades"),
    ("No activity yet", "Nenhuma atividade ainda"),
    ("View all", "Ver tudo"),
    ("Today", "Hoje"),
    ("Yesterday", "Ontem"),
    ("Last 7 days", "Últimos 7 dias"),
    ("Last 30 days", "Últimos 30 dias"),
    ("Last 90 days", "Últimos 90 dias"),

    # Inbox
    ("Inbox", "Caixa de Entrada"),
    ("Search conversations", "Buscar conversas"),
    ("Search conversations...", "Buscar conversas..."),
    ("All conversations", "Todas as conversas"),
    ("Assigned to me", "Atribuído a mim"),
    ("Unassigned", "Não atribuído"),
    ("Open", "Aberto"),
    ("Resolved", "Resolvido"),
    ("No conversations", "Nenhuma conversa"),
    ("No conversations found", "Nenhuma conversa encontrada"),
    ("Type a message", "Digite uma mensagem"),
    ("Type a message...", "Digite uma mensagem..."),
    ("Send", "Enviar"),
    ("Assign to", "Atribuir para"),
    ("Resolve", "Resolver"),
    ("Reopen", "Reabrir"),
    ("Add note", "Adicionar nota"),
    ("Internal note", "Nota interna"),
    ("Note", "Nota"),
    ("Save note", "Salvar nota"),
    ("Cancel", "Cancelar"),
    ("No messages yet", "Nenhuma mensagem ainda"),
    ("Mark as read", "Marcar como lido"),
    ("Mark as unread", "Marcar como não lido"),

    # Contacts
    ("Contacts", "Contatos"),
    ("Add contact", "Adicionar contato"),
    ("Import contacts", "Importar contatos"),
    ("Search contacts", "Buscar contatos"),
    ("Search contacts...", "Buscar contatos..."),
    ("No contacts found", "Nenhum contato encontrado"),
    ("Phone number", "Número de telefone"),
    ("Phone", "Telefone"),
    ("Name", "Nome"),
    ("Email", "E-mail"),
    ("Tags", "Etiquetas"),
    ("Created at", "Criado em"),
    ("Last contact", "Último contato"),
    ("Edit contact", "Editar contato"),
    ("Delete contact", "Excluir contato"),
    ("Save", "Salvar"),
    ("Save changes", "Salvar alterações"),
    ("Saving...", "Salvando..."),

    # Pipelines
    ("Pipelines", "Funis"),
    ("Add pipeline", "Adicionar funil"),
    ("Add deal", "Adicionar negócio"),
    ("No pipelines", "Nenhum funil"),
    ("Stage", "Etapa"),
    ("Value", "Valor"),
    ("Won", "Ganho"),
    ("Lost", "Perdido"),
    ("Deal value", "Valor do negócio"),

    # Broadcasts
    ("Broadcasts", "Transmissões"),
    ("New broadcast", "Nova transmissão"),
    ("Draft", "Rascunho"),
    ("Sent", "Enviado"),
    ("Failed", "Falhou"),
    ("Scheduled", "Agendado"),
    ("Recipients", "Destinatários"),
    ("Delivered", "Entregue"),
    ("Read", "Lido"),
    ("Template", "Modelo"),
    ("Select template", "Selecionar modelo"),

    # Automations
    ("Automations", "Automações"),
    ("New automation", "Nova automação"),
    ("Trigger", "Gatilho"),
    ("Action", "Ação"),
    ("Condition", "Condição"),
    ("Active", "Ativo"),
    ("Inactive", "Inativo"),
    ("Enable", "Ativar"),
    ("Disable", "Desativar"),
    ("Edit", "Editar"),
    ("Delete", "Excluir"),
    ("Duplicate", "Duplicar"),

    # Settings labels
    ("Password", "Senha"),
    ("Current password", "Senha atual"),
    ("New password", "Nova senha"),
    ("Confirm new password", "Confirmar nova senha"),
    ("Update password", "Atualizar senha"),
    ("Update profile", "Atualizar perfil"),
    ("Avatar", "Avatar"),
    ("Display name", "Nome de exibição"),
    ("Appearance", "Aparência"),
    ("Dark", "Escuro"),
    ("Light", "Claro"),
    ("System", "Sistema"),
    ("Members", "Membros"),
    ("Invite member", "Convidar membro"),
    ("Role", "Função"),
    ("Remove", "Remover"),
    ("Loading...", "Carregando..."),
    ("Error", "Erro"),
    ("Success", "Sucesso"),
    ("Connect", "Conectar"),
    ("Connected", "Conectado"),
    ("Disconnect", "Desconectar"),
    ("Verify", "Verificar"),
    ("Save configuration", "Salvar configuração"),
    ("Phone Number ID", "ID do Número de Telefone"),
    ("Access Token", "Token de Acesso"),
    ("Verify Token", "Token de Verificação"),
    ("WhatsApp Business Account ID", "ID da Conta Business WhatsApp"),
    ("Webhook URL", "URL do Webhook"),
    ("Copy", "Copiar"),
    ("Copied!", "Copiado!"),
    ("Test connection", "Testar conexão"),
    ("Add tag", "Adicionar etiqueta"),
    ("No tags", "Nenhuma etiqueta"),
    ("Color", "Cor"),
    ("Label", "Rótulo"),
    ("Create tag", "Criar etiqueta"),
    ("Edit tag", "Editar etiqueta"),
    ("Delete tag", "Excluir etiqueta"),

    # Misc
    ("Search...", "Buscar..."),
    ("No results found", "Nenhum resultado encontrado"),
    ("something went wrong", "algo deu errado"),
    ("Something went wrong", "Algo deu errado"),
    ("Try again", "Tentar novamente"),
    ("Close", "Fechar"),
    ("Back", "Voltar"),
    ("Next", "Próximo"),
    ("Previous", "Anterior"),
    ("Confirm", "Confirmar"),
    ("Are you sure?", "Tem certeza?"),
    ("This action cannot be undone.", "Esta ação não pode ser desfeita."),
    ("Optional", "Opcional"),
    ("Required", "Obrigatório"),
    ("Select", "Selecionar"),
    ("Upload", "Enviar"),
    ("Download", "Baixar"),
    ("Refresh", "Atualizar"),
    ("Filter", "Filtrar"),
    ("Sort", "Ordenar"),
    ("Export", "Exportar"),
    ("Import", "Importar"),
    ("Add", "Adicionar"),
    ("Create", "Criar"),
    ("New", "Novo"),
    ("None", "Nenhum"),
    ("All", "Todos"),
]

def translate_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        for en, pt in translations:
            content = content.replace(en, pt)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"  ERRO em {filepath}: {e}")
        return False

# Processar todos os arquivos .tsx e .ts em /src
src_dir = '/srv/wacrm/src'
changed = 0
total = 0

for root, dirs, files in os.walk(src_dir):
    # Ignorar node_modules e .next
    dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '.git']]
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            filepath = os.path.join(root, file)
            total += 1
            if translate_file(filepath):
                changed += 1
                print(f"  ✅ {filepath.replace('/srv/wacrm/src/', '')}")

print(f"\n📊 Resultado: {changed}/{total} arquivos traduzidos")
