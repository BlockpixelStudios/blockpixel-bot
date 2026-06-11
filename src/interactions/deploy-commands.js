const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Definição do comando /criar-missao
const commands = [
    new SlashCommandBuilder()
        .setName('criar-missao')
        .setDescription('Cria uma nova missão para a equipe da Blockpixel Studios.')
].map(command => command.toJSON());

// Prepara o cliente REST do Discord
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Função para registrar os comandos no servidor
(async () => {
    try {
        console.log('🔄 Iniciando a atualização dos comandos (/) globais ou locais...');

        // Registra os comandos especificamente no seu servidor de testes (mais rápido)
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('✅ Comandos (/) registrados com sucesso no servidor!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
})();
                                            
