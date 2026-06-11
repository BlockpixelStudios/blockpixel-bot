const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../missoes.json');

function lerMissoes() {
    try { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch { return []; }
}

function salvarMissoes(missoes) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(missoes, null, 2), 'utf8');
    } catch (error) {
        console.error('❌ Erro ao salvar missoes.json no botão assumir:', error);
    }
}

module.exports = {
    async execute(interaction, client) {
        // Pega o ID da missão direto do customId do botão
        const missaoId = interaction.customId.replace('assumir_', '');
        const listaMissoes = lerMissoes();
        const missao = listaMissoes.find(m => m.id === missaoId);

        if (!missao) {
            return interaction.reply({ content: '❌ Missão não encontrada no sistema ou já foi concluída.', ephemeral: true });
        }

        if (missao.status !== 'Disponível') {
            return interaction.reply({ content: '❌ Esta missão já foi assumida por outra pessoa!', ephemeral: true });
        }

        // Avisa o Discord que estamos processando (evita o carregamento infinito)
        await interaction.deferReply({ ephemeral: true });

        const servidor = interaction.guild;

        try {
            // 1. Cria o canal de texto privado para a entrega (Removido o process.env causador do travamento)
            const canalEntrega = await servidor.channels.create({
                name: `entrega-${interaction.user.username}`,
                type: 0, // 0 = Canal de Texto
                permissionOverwrites: [
                    {
                        id: servidor.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel], // Esconde de todos os membros comuns
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles], // Permite o dono da missão ver e enviar arquivos
                    },
                    {
                        id: servidor.ownerId, // Permite o dono do servidor ver sempre, por garantia
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    }
                ],
            });

            // 2. Atualiza os dados da missão no JSON
            missao.status = 'Em Andamento';
            missao.responsavelId = interaction.user.id;
            missao.canalEntregaId = canalEntrega.id;
            salvarMissoes(listaMissoes);

            // 3. Atualiza o Card Original no canal de missões da equipe
            const embedOriginal = interaction.message.embeds[0];
            const embedAtualizado = EmbedBuilder.from(embedOriginal)
                .setColor('#FEE75C') // Muda para amarelo (em andamento)
                .spliceFields(1, 1, { name: '📊 Status', value: `Em Andamento | Responsável: <@${interaction.user.id}>`, inline: true });

            // Desativa o botão de assumir para ninguém mais clicar
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

            // 5. Finaliza a resposta do botão de quem assumiu
            await interaction.editReply({ content: `✅ Você assumiu a missão! O seu canal de entrega foi criado com sucesso: <#${canalEntrega.id}>` });

        } catch (error) {
            console.error('❌ Erro crítico ao criar canal ou assumir missão:', error);
            await interaction.editReply({ content: '❌ Houve um erro interno no servidor ao tentar criar seu canal privado. Avise um administrador!' });
        }
    }
};
            
