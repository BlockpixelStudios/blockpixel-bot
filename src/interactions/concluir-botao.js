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
        const missaoId = interaction.customId.replace('concluir_', '');
        const listaMissoes = lerMissoes();
        const missao = listaMissoes.find(m => m.id === missaoId);

        if (!missao) {
            return interaction.reply({ content: '❌ Missão não encontrada no sistema.', ephemeral: true });
        }

        // Garante que apenas o responsável pela missão possa clicar no botão de concluir
        if (interaction.user.id !== missao.responsavelId) {
            return interaction.reply({ content: '❌ Apenas o membro responsável por esta missão pode concluí-la!', ephemeral: true });
        }

        // Evita cliques duplos ou bugs de estado
        if (missao.status === 'Aguardando Aprovação') {
            return interaction.reply({ content: '❌ Esta missão já está aguardando a aprovação da direção.', ephemeral: true });
        }

        // Responde de forma efêmera antes de apagar o canal para evitar erro de interação expirada
        await interaction.reply({ content: '🚀 Enviando sua entrega para a Direção... Este canal será excluído em instantes!', ephemeral: true });

        // 1. Atualiza o status no JSON
        missao.status = 'Aguardando Aprovação';
        salvarMissoes(listaMissoes);

        // 2. Envia a notificação com os botões de aprovação na DM do Diretor que criou a missão
        try {
            const diretor = await client.users.fetch(missao.autorDirecaoId);
            
            const embedAvaliacao = new EmbedBuilder()
                .setTitle(`🔔 Missão Pronta para Avaliação: ${missao.titulo}`)
                .setColor('#3498DB')
                .setDescription(`O membro <@${missao.responsavelId}> marcou esta missão como concluída. Avalie o trabalho entregue antes de tomar uma decisão.`)
                .addFields(
                    { name: '📂 Setor', value: missao.setor, inline: true },
                    { name: '👤 Responsável', value: `<@${missao.responsavelId}>`, inline: true },
                    { name: '📝 Descrição da Tarefa', value: missao.descricao }
                )
                .setFooter({ text: `ID da Missão: ${missao.id}` })
                .setTimestamp();

            const botaoSim = new ButtonBuilder()
                .setCustomId(`aprovar_sim_${missao.id}`)
                .setLabel('Aprovar')
                .setEmoji('🟢')
                .setStyle(ButtonStyle.Success);

            const botaoNao = new ButtonBuilder()
                .setCustomId(`aprovar_nao_${missao.id}`)
                .setLabel('Recusar')
                .setEmoji('🔴')
                .setStyle(ButtonStyle.Danger);

            const rowAvaliacao = new ActionRowBuilder().addComponents(botaoSim, botaoNao);

            await diretor.send({ embeds: [embedAvaliacao], components: [rowAvaliacao] });
        } catch (error) {
            console.error(`❌ Não foi possível enviar a DM de avaliação para o diretor ${missao.autorDirecaoId}:`, error);
        }

        // 3. Deleta o canal privado de entrega (espera 3 segundos para dar tempo do usuário ler o feedback)
        setTimeout(async () => {
            try {
                const canal = await interaction.guild.channels.fetch(missao.canalEntregaId);
                if (canal) await canal.delete('Missão enviada para aprovação.');
            } catch (error) {
                console.error('Erro ao deletar o canal de entrega:', error);
            }
        }, 3000);
    }
};

