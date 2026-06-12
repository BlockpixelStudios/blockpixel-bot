const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../missoes.json');

// --- SISTEMA DE PROTEÇÃO ANTI-VAZAMENTO (Recuperando a ID fixa do canal) ---
const canalMissoesInvertido = "1146084649942644151";
const desinverter = (texto) => texto.split('').reverse().join('').trim();
const CANAL_MISSOES_ID = desinverter(canalMissoesInvertido);
// ---------------------------------------------------------------------------

function lerMissoes() {
    try { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch { return []; }
}

function salvarMissoes(missoes) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(missoes, null, 2), 'utf8');
    } catch (error) {
        console.error('❌ Erro ao salvar missoes.json nos botões da direção:', error);
    }
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
            await interaction.deferReply({ ephemeral: true });

            try {
                // 1. Apaga o card original do canal de missões da equipe (Usando ID seguro)
                const canalMissoes = await client.channels.fetch(CANAL_MISSOES_ID);
                const msgEquipe = await canalMissoes.messages.fetch(missao.msgEquipeId);
                if (msgEquipe) await msgEquipe.delete();
            } catch (e) { console.log('Card da equipe já tinha sido apagado ou não foi achado.'); }

            // 2. Avisa o membro na DM dele que a missão foi aprovada
            try {
                const membro = await client.users.fetch(missao.responsavelId);
                await membro.send(`🎉 Parabéns! A direção aprovou a sua entrega da missão **"${missao.titulo}"**! Trabalho concluído.`);
            } catch (e) { console.log('Não foi possível mandar DM para o membro.'); }

            // 3. Deleta o canal privado de entrega se ele ainda existir
            try {
                const canalPrivado = await interaction.guild.channels.fetch(missao.canalEntregaId);
                if (canalPrivado) await canalPrivado.delete();
            } catch (e) { console.log('Canal privado de entrega já deletado ou inexistente.'); }

            // 4. Limpa o JSON tirando a missão de lá
            listaMissoes.splice(missaoIndex, 1);
            salvarMissoes(listaMissoes);

            // 5. Atualiza a mensagem da DM do diretor desativando os botões
            await interaction.message.edit({ content: `✅ **Missão Aprovada!** O card público foi removido e o canal privado de entregas foi encerrado com sucesso.`, embeds: [], components: [] });
            await interaction.editReply({ content: '✅ Ação de aprovação concluída!' });
        }

        // --- AÇÃO: RECUSAR MISSÃO 🔴 ---
        else if (acao === 'recusar') {
            await interaction.deferReply({ ephemeral: true });

            const responsavelAnteriorId = missao.responsavelId;
            
            // 1. Reseta a missão no JSON para o estado inicial
            missao.status = 'Disponível';
            missao.responsavelId = null;
            missao.canalEntregaId = null;
            salvarMissoes(listaMissoes);

            try {
                // 2. Reativa o botão de assumir missão lá no canal da equipe (Usando ID seguro)
                const canalMissoes = await client.channels.fetch(CANAL_MISSOES_ID);
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
                await membro.send(`⚠️ Sua entrega para a missão **"${missao.titulo}"** foi revisada pela direção e precisa de alguns ajustes. Ela voltou a ficar disponível para a equipe.`);
            } catch (e) { console.log('Não foi possível mandar DM para o membro.'); }

            await interaction.message.edit({ content: `🔴 **Entrega Recusada.** A missão voltou a ficar listada como disponível para a equipe.`, embeds: [], components: [] });
            await interaction.editReply({ content: '🔴 Ação de recusa efetuada!' });
        }

        // --- AÇÃO: CANCELAR MISSÃO ❌ (Atualizado conforme seu pedido!) ---
        else if (acao === 'cancelar') {
            await interaction.deferReply({ ephemeral: true });

            try {
                // Edita o card do canal público avisando que foi cancelada, em vez de só deletar!
                const canalMissoes = await client.channels.fetch(CANAL_MISSOES_ID);
                const msgEquipe = await canalMissoes.messages.fetch(missao.msgEquipeId);
                
                if (msgEquipe) {
                    const embedCancelado = EmbedBuilder.from(msgEquipe.embeds[0])
                        .setColor('#607D8B') // Cor cinza fosca para desativado
                        .setTitle(`❌ Missão Cancelada: ${missao.titulo}`)
                        .spliceFields(1, 1, { name: '📊 Status', value: '🛑 Cancelada pela Direção', inline: true });

                    // Atualiza removendo completamente os botões de assumir
                    await msgEquipe.edit({ embeds: [embedCancelado], components: [] });
                }
            } catch (e) { console.log('Card público não encontrado para editar cancelamento.'); }

            // Se houver canal privado aberto para ela, deleta por segurança
            if (missao.canalEntregaId) {
                try {
                    const canalPrivado = await interaction.guild.channels.fetch(missao.canalEntregaId);
                    if (canalPrivado) await canalPrivado.delete();
                } catch (e) { console.log('Sem canais abertos pendentes para remover.'); }
            }

            listaMissoes.splice(missaoIndex, 1);
            salvarMissoes(listaMissoes);

            await interaction.message.edit({ content: `❌ **Missão Cancelada.** O card da equipe foi desativado e o registro foi limpo.`, embeds: [], components: [] });
            await interaction.editReply({ content: '❌ Missão cancelada com sucesso.' });
        }

        // --- AÇÃO: EDIÇÃO RÁPIDA VIA CHAT ⚙️ ---
        else if (acao === 'editar') {
            // Avisa o usuário e garante a criação do canal de DM direto no usuário para o coletor funcionar
            await interaction.reply({ content: '✍️ Digite o novo **Título** e a nova **Descrição** da missão separados por uma barra vertical `|`. \n\n*Exemplo: Novo Título | Esta é a nova descrição da missão.* \n\n⏱️ Você tem 60 segundos para responder aqui na DM.', ephemeral: true });

            // Abre o canal de DM do diretor de forma explícita para evitar falhas de cache
            const canalDM = await interaction.user.createDM();
            
            const filtro = m => m.author.id === interaction.user.id;
            const coletor = canalDM.createMessageCollector({ filter: filtro, max: 1, time: 60000 });

            coletor.on('collect', async m => {
                const partes = m.content.split('|');
                if (partes.length < 2) {
                    return m.reply('❌ Formato inválido! Você precisa usar a barra `|` para separar o título da descrição.\nClique no botão **Editar** novamente para tentar de novo.');
                }

                const novoTitulo = partes[0].trim();
                const novaDescricao = partes[1].trim();

                // Recarrega a lista do JSON para evitar conflitos de salvamento assíncrono
                const listaAtualizada = lerMissoes();
                const missaoAtualizada = listaAtualizada.find(m => m.id === missaoId);

                if (!missaoAtualizada) {
                    return m.reply('❌ Erro: Essa missão sumiu do sistema durante o processo de edição.');
                }

                // Atualiza as propriedades no banco de dados local
                missaoAtualizada.titulo = novoTitulo;
                missaoAtualizada.descricao = novaDescricao;
                salvarMissoes(listaAtualizada);

                // Atualiza o Card no canal público da equipe (Usando ID seguro)
                try {
                    const canalMissoes = await client.channels.fetch(CANAL_MISSOES_ID);
                    const msgEquipe = await canalMissoes.messages.fetch(missaoAtualizada.msgEquipeId);
                    
                    const embedEditado = EmbedBuilder.from(msgEquipe.embeds[0])
                        .setTitle(`⚔️ Nova Missão: ${novoTitulo}`)
                        .spliceFields(2, 1, { name: '📝 Descrição', value: novaDescricao });

                    await msgEquipe.edit({ embeds: [embedEditado] });
                } catch (e) { console.error('Erro ao atualizar card público na edição:', e); }

                // Atualiza o próprio card de controle na DM do diretor
                try {
                    if (interaction.message && interaction.message.embeds.length > 0) {
                        const embedDirecaoEditado = EmbedBuilder.from(interaction.message.embeds[0])
                            .setTitle(`⚙️ Controle de Missão: ${novoTitulo}`)
                            .spliceFields(2, 1, { name: '📝 Descrição', value: novaDescricao });

                        await interaction.message.edit({ embeds: [embedDirecaoEditado] });
                    }
                } catch (e) { console.log('Não foi possível editar o card de controle visual do diretor.'); }

                await m.reply('✅ **Missão Editada com Sucesso!** O card da equipe e o seu painel de controle foram atualizados.');
            });

            coletor.on('end', (coletado, razao) => {
                if (razao === 'time' && coletado.size === 0) {
                    canalDM.send('⏱️ **Tempo esgotado!** O coletor de edição foi fechado por inatividade. Clique em Editar no card novamente se precisar alterar.').catch(() => {});
                }
            });
        }
    }
};
                                                
