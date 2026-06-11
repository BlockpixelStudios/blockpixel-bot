const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    name: 'criar-missao',
    description: 'Abre o formulário para criar uma nova missão',
    async execute(interaction) {
        try {
            // Cria o Modal (Formulário)
            const modal = new ModalBuilder()
                .setCustomId('formulario_missao')
                .setTitle('⚔️ Criar Nova Missão');

            // Campo: Título da Missão
            const tituloInput = new TextInputBuilder()
                .setCustomId('missao_titulo')
                .setLabel('Título da Missão')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: Configurar Plugin de Placas')
                .setRequired(true);

            // Campo: Setor responsável
            const setorInput = new TextInputBuilder()
                .setCustomId('missao_setor')
                .setLabel('Setor Responsável')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: Dev, Construção, Textura')
                .setRequired(true);

            // Campo: Descrição detalhada
            const descricaoInput = new TextInputBuilder()
                .setCustomId('missao_descricao')
                .setLabel('Descrição Detalhada')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Explique detalhadamente o que precisa ser feito...')
                .setRequired(true);

            // Transforma os inputs em linhas de ação do formulário
            const primeiraLinha = new ActionRowBuilder().addComponents(tituloInput);
            const segundaLinha = new ActionRowBuilder().addComponents(setorInput);
            const terceiraLinha = new ActionRowBuilder().addComponents(descricaoInput);

            // Adiciona os campos ao formulário
            modal.addComponents(primeiraLinha, segundaLinha, terceiraLinha);

            // Abre o formulário para o usuário que digitou o comando
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('❌ Erro interno dentro do comando criar-missao:', error);
            // Lança o erro para o index.js capturar e sabermos o que houve no console
            throw error; 
        }
    }
};
                
