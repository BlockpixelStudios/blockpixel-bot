const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
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
        // Pega o ID da missão direto do customId do botão (ex: assumir_m_12345 -> m_12345)
        const missaoId = interaction.customId.replace('assumir_', '');
        const listaMissoes = lerMissoes();
        const missao = listaMissoes.find(m => m.id === missaoId);

        if (!missao) {
            return interaction.reply({ content: '❌ Missão não encontrada no sistema ou já foi concluída.', ephemeral: true });
        }

        if (missao.status !== 'Disponível') {
            return interaction.reply({ content: '❌ Esta missão já foi assumida por outra pessoa!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        // 1. Atualiza os dados da missão no JSON
        missao.status = 'Em Andamento';
        missao.responsavelId = interaction.user.id;

        // 2. Cria o canal de texto privado para a entrega (ex: #entrega-nome)
        const servidor = interaction.guild;
        const canalEntrega = await servidor.channels.create({
            name: `entrega-${interaction.user.username}`,
            type: 0, // 0 = Canal de Texto
            permissionOverwrites: [
                {
                    id: servidor.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel], // Esconde de todos
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages], // Permite o membro ver
                },
                {
                    id: process.env.DIRECAO_ID, // Permite a direção ver (ID do cargo)
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                }
            ],
        });

        missao.canalEntregaId = canalEntrega.id;
        salvarMissoes(listaMissoes);

        // 3. Atualiza o Card Original no canal de missões da equipe
        const embedAtualizado = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#FEE75C') // Muda para amarelo (em andamento)
            .spliceFields(1, 1, { name: '📊 Status', value: `Em Andamento | Responsável: <@${interaction.user.id}>`, inline: true });

        // Desativa o botão de assumir
        const botaoDesativado = new ButtonBuilder()
            .setCustomId(`assumido_${missaoId}`)
            .setLabel('Missão em Andamento')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        const rowAtualizada = new ActionRowBuilder().addComponents(botaoDesativado);
        await interaction.message.edit({ embeds: [embedAtualizado], components: [rowAtualizada] });

        // 4. Envia a mensagem de boas-vindas no canal privado criado
        const embedCanalPrivado = new EmbedBuilder()
            .setTitle(`⚔️ Canal de Entrega: ${missao.titulo}`)
            .setDescription(`Olá <@${interaction.user.id}>, este é o seu canal privado para realizar a tarefa.\n\nQuando terminar tudo, envie as provas/arquivos aqui e clique no botão abaixo para avisar a direção!`)
            .setColor('#FEE75C');

        const botaoConcluir = new ButtonBuilder()
            .setCustomId(`concluir_${missaoId}`)
            .setLabel('Concluir Missão')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success);

        const rowCanalPrivado = new ActionRowBuilder().addComponents(botaoConcluir);
        await canalEntrega.send({ content: `<@${interaction.user.id}>`, embeds: [embedCanalPrivado], components: [rowCanalPrivado] });

        await interaction.editReply({ content: `✅ Você assumiu a missão! O seu canal de entrega foi criado: <#${canalEntrega.id}>` });
    }
};
      
