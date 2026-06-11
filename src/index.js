const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Cria a instância do Bot com as permissões necessárias
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Evento: Quando o bot ligar com sucesso
client.once('ready', () => {
    console.log(`🤖 Bot online com sucesso como: ${client.user.tag}!`);
});

// Evento: Gerenciador de Interações (Comandos e Botões)
client.on('interactionCreate', async interaction => {
    // 1. Se for um comando Slash (/criar-missao)
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'criar-missao') {
            try {
                // Vamos linkar a lógica do comando aqui no próximo passo
                await interaction.reply({ content: '🚧 O formulário de missão está sendo implementado no próximo arquivo!', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: '❌ Houve um erro ao executar esse comando.', ephemeral: true });
            }
        }
    }

    // 2. Se for um clique em botão ou envio de formulário (Modal)
    // Deixaremos pronto para os próximos passos do fluxo
});

// Liga o bot usando o Token das variáveis de ambiente
client.login(process.env.DISCORD_TOKEN);
      
