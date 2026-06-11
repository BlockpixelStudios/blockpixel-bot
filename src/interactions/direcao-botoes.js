const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../missoes.json');

function lerMissoes() {
    try { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch { return []; }
}

function salvarMissoes(missoes) {
    fs.writeFileSync(dbPath, JSON.stringify(missoes, null, 2), 'utf8');
}

module.exports = {
    async execute(interaction, client) {
        const customId = interaction.customId;
        const listaMissoes = lerMissoes();
        
        // Identifica qual botão foi clicado e extrai o ID da missão
        let missaoId, acao;
        if (customId.startsWith('aprovar_sim_')) { missaoId = customId.replace('aprovar_sim_', ''); acao = 'aprovar'; }
        else if (customId.startsWith('aprovar_nao_')) { missaoId = customId.replace('aprovar_nao_', ''); acao = 'recusar'; }
        else if (customId.startsWith('cancelar_')) { missaoId = customId.replace('cancelar_', ''); acao = 'cancelar'; }
        else if (customId.startsWith('editar_')) { missaoId = customId.replace('editar_', ''); acao = 'editar'; }

        const missaoIndex = listaMissoes.findIndex(m => m.id === missaoId);
        const missao = listaMissoes[missaoIndex];

        if (!missao) {
            return interaction.reply({ content: '❌ Esta missão não existe mais no sistema.', ephemeral: true });
        }

        // --- AÇÃO: APROVAR MISSÃO 🟢 ---
        if (acao === 'aprovar') {
            await interaction.deferReply();

            try {
                // 1. Apaga o card original do canal de missões da equipe
                const canalMissoes = await client.channels.fetch(process.env.CANAL_MISSOES_ID);
                const msgEquipe = await canalMissoes.messages.fetch(missao.msgEquipeId);
                if (msgEquipe) await msgEquipe.delete();
            } catch (e) { console.log('Card da equipe já tinha sido apagado ou não foi achado.'); }

            // 2. Avisa o membro na DM dele que a missão foi aprovada
            try {
                const membro = await client.users.fetch(missao.responsavelId);
                await membro.send(`🎉 Parabéns! A direção aprovou a sua entrega da missão **"${missao.titulo}"**! Trabalho concluído.`);
            } catch (e) { console.log('Não foi possível mandar DM para o membro.'); }

            // 3. Limpa o JSON tirando a missão de lá
            listaMissoes.splice(missaoIndex, 1);
            salvarMissoes(listaMissoes);

            // 4. Atualiza a mensagem da DM do diretor desativando os botões
            await interaction.message.edit({ content: `✅ **Missão Aprovada!** O ambiente foi limpo com sucesso.`, embeds: [], components: [] });
            await interaction.deleteReply();
        }

        // --- AÇÃO: RECUSAR MISSÃO 🔴 ---
        else if (acao === 'recusar') {
            await interaction.deferReply();

            // 1. Reseta a missão no JSON para o estado inicial
            const responsavelAnteriorId = missao.responsavelId;
            missao.status = 'Disponível';
            missao.responsavelId = null;
            missao.canalEntregaId = null;
            salvarMissoes(listaMissoes);

            try {
                // 2. Reativa o botão de assumir missão lá no canal da equipe
                const canalMissoes = await client.channels.fetch(process.env.CANAL_MISSOES_ID);
                const msgEquipe = await canalMissoes.messages.fetch(missao.msgEquipeId);
                
                const embedOriginal = EmbedBuilder.from(msgEquipe.embeds[0])
                    .setColor('#5865F2')
                    .spliceFields(1, 1, { name: '📊 Status', value: 'Disponível', inline: true });

                const botaoAssumir = new ButtonBuilder()
                    .setCustomId(`assumir_${missao.id}`)
                    .setLabel('Assumir Missão')
                    .setEmoji('⚔️')
                    .setStyle(ButtonStyle.Success);

                const row = new ActionRowBuilder().addComponents(botaoAssumir);
                await msgEquipe.edit({ embeds: [embedOriginal], components: [row] });
            } catch (e) { console.error('Erro ao resetar card da equipe:', e); }

            // 3. Avisa o membro na DM sobre a recusa
            try {
                const membro = await client.users.fetch(responsavelAnteriorId);
                await membro.send(`⚠️ Sua entrega para a missão **"${missao.titulo}"** foi revisada pela direção e precisa de ajustes. Ela voltou a ficar disponível no canal de missões.`);
            } catch (e) { console.log('Não foi possível mandar DM para o membro.'); }

            await interaction.message.edit({ content: `🔴 **Entrega Recusada.** A missão voltou para o canal da equipe como disponível.`, embeds: [], components: [] });
            await interaction.deleteReply();
        }

        // --- AÇÃO: CANCELAR MISSÃO ❌ ---
        else if (acao === 'cancelar') {
            await interaction.deferReply();

            try {
                // Apaga o card do canal público
                const canalMissoes = await client.channels.fetch(process.env.CANAL_MISSOES_ID);
                const msgEquipe = await canalMissoes.messages.fetch(missao.msgEquipeId);
                if (msgEquipe) await msgEquipe.delete();
            } catch (e) { console.log('Card público não encontrado para deletar.'); }

            listaMissoes.splice(missaoIndex, 1);
            salvarMissoes(listaMissoes);

            await interaction.message.edit({ content: `❌ **Missão Cancelada e Excluída.**`, embeds: [], components: [] });
            await interaction.deleteReply();
        }

        // --- AÇÃO: EDICAO RÁPIDA VIA CHAT ⚙️ ---
        else if (acao === 'editar') {
            // Como abrir modais a partir de cliques em DMs pode ser instável em conexões mobile,
            // vamos pedir as novas informações de forma simples no chat de DM.
            await interaction.reply({ content: '✍️ Digite o novo **Título** e a nova **Descrição** da missão separados por uma barra vertical `|`. \n*Exemplo: Novo Título | Esta é a nova descrição da missão.*', ephemeral: true });

            const filtro = m => m.author.id === interaction.user.id;
            const coletor = interaction.channel.createMessageCollector({ filter: filtro, max: 1, time: 60000 });

            coletor.on('collect', async m => {
                const partes = m.content.split('|');
                if (partes.length < 2) {
                    return m.reply('❌ Formato inválido! Você precisa usar a barra `|` para separar o título da descrição. Tente clicar em Editar novamente.');
                }

                const novoTitulo = partes[0].trim();
                const novaDescricao = partes[1].trim();

                // Atualiza o JSON
                missao.titulo = novoTitulo;
                missao.descricao = novaDescricao;
                salvarMissoes(listaMissoes);

                // Atualiza o Card no canal público da equipe
                try {
                    const canalMissoes = await client.channels.fetch(process.env.CANAL_MISSOES_ID);
                    const msgEquipe = await canalMissoes.messages.fetch(missao.msgEquipeId);
                    
                    const embedEditado = EmbedBuilder.from(msgEquipe.embeds[0])
                        .setTitle(`⚔️ Nova Missão: ${novoTitulo}`)
                        .spliceFields(2, 1, { name: '📝 Descrição', value: novaDescricao });

                    await msgEquipe.edit({ embeds: [embedEditado] });
                } catch (e) { console.error('Erro ao atualizar card público na edição:', e); }

                // Atualiza o próprio card na DM do diretor
                const embedDirecaoEditado = EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle(`⚙️ Controle de Missão: ${novoTitulo}`)
                    .spliceFields(2, 1, { name: '📝 Descrição', value: novaDescricao });

                await interaction.message.edit({ embeds: [embedDirecaoEditado] });
                await m.reply('✅ Missão editada e atualizada com sucesso nos canais!');
            });
        }
    }
};

