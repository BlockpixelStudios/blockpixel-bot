const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('criar-missao')
        .setDescription('Abre o formulário para criar uma nova missão.'),

    async execute(interaction) {
        // Cria o formulário (Modal)
        const modal = new ModalBuilder()
            .setCustomId('formulario_missao')
            .setTitle('Criar Nova Missão ⚔️');

        // Campo 1: Título da Missão (Curto)
        const tituloInput = new TextInputBuilder()
            .setCustomId('missao_titulo')
            .setLabel('Título da Missão')
            .setPlaceholder('Ex: Modelagem do Personagem Principal')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Campo 2: Setor (Curto)
        const setorInput = new TextInputBuilder()
            .setCustomId('missao_setor')
            .setLabel('Setor Responsável')
            .setPlaceholder('Ex: Arte 3D, Programação, Sound Design')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Campo 3: Descrição da Missão (Longo)
        const descricaoInput = new TextInputBuilder()
            .setCustomId('missao_descricao')
            .setLabel('Descrição Detalhada')
            .setPlaceholder('Descreva o que precisa ser feito nesta tarefa...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        // Transforma os inputs em linhas de ação necessárias para o Modal
        const firstActionRow = new ActionRowBuilder().addComponents(tituloInput);
        const secondActionRow = new ActionRowBuilder().addComponents(setorInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(descricaoInput);

        // Adiciona as linhas ao formulário
        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        // Mostra o formulário para o usuário que digitou o comando
        await interaction.showModal(modal);
    }
};

