const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Caminho absoluto para o arquivo de configuração na host
const configPath = '/home/container/configuracao.json';
let config = {};

// Carrega as configurações de forma segura se o arquivo existir
try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (error) {
    console.error('⚠️ Não foi possível ler o arquivo configuracao.json local:', error.message);
}

// Atalhos para não precisar alterar o resto do código (mapeia o config para o escopo ou variáveis)
const TOKEN = config.DISCORD_TOKEN;
const CLIENT_ID = config.CLIENT_ID;
const GUILD_ID = config.GUILD_ID;
const CANAL_MISSOES_ID = config.CANAL_MISSOES_ID;

// Importa os módulos de comandos e interações
const criarMissaoComando = require('./commands/criar-missao.js');
const assumirBotao = require('./interactions/assumir-botao.js');
const concluirBotao = require('./interactions/concluir-botao.js');
const direcaoBotoes = require('./interactions/direcao-botoes.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Caminho do arquivo de banco de dados local
const dbPath = path.join(__dirname, '../missoes.json');

function lerMissoes() {
    try {
        const dados = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(dados);
    } catch (error) {
        return [];
    }
}

function salvarMissoes(missoes) {
    fs.writeFileSync(dbPath, JSON.stringify(missoes, null, 2), 'utf8');
}

// Evento disparado quando o bot se conecta ao Discord
client.once('ready', async () => {
    console.log(`🤖 Bot online com sucesso como: ${client.user.tag}!`);

    // DEPLOY AUTOMÁTICO DE COMANDOS
    if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
        console.error('❌ Erro no Deploy: O arquivo configuracao.json foi deletado pelo script de inicialização da Host ou está incompleto.');
        return;
    }

    try {
        console.log('🔄 Sincronizando o comando (/criar-missao) com o servidor...');
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        
        const commands = [
            {
                name: 'criar-missao',
                description: 'Abre o formulário para criar uma nova missão para a equipe da Blockpixel Studios.'
            }
        ];

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('✅ Comando (/criar-missao) registrado com sucesso no Discord!');
    } catch (error) {
        console.error('❌ Erro ao registrar comando no deploy automático:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'criar-missao') {
            try {
                await criarMissaoComando.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: '❌ Erro ao abrir o formulário.', ephemeral: true });
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'formulario_missao') {
            await interaction.deferReply({ ephemeral: true });

            const titulo = interaction.fields.getTextInputValue('missao_titulo');
            const setor = interaction.fields.getTextInputValue('missao_setor');
            const descricao = interaction.fields.getTextInputValue('missao_descricao');
            const missaoId = `m_${Date.now()}`;

            const embedEquipe = new EmbedBuilder()
                .setTitle(`⚔️ Nova Missão: ${titulo}`)
                .setColor('#5865F2')
                .addFields(
                    { name: '📂 Setor', value: setor, inline: true },
                    { name: '📊 Status', value: 'Disponível', inline: true },
                    { name: '📝 Descrição', value: descricao }
                )
                .setFooter({ text: `ID da Missão: ${missaoId}` })
                .setTimestamp();

            const botaoAssumir = new ButtonBuilder()
                .setCustomId(`assumir_${missaoId}`)
                .setLabel('Assumir Missão')
                .setEmoji('⚔️')
                .setStyle(ButtonStyle.Success);

            const rowEquipe = new ActionRowBuilder().addComponents(botaoAssumir);

            try {
                // Usa a variável local carregada do JSON
                const canalMissoes = await client.channels.fetch(CANAL_MISSOES_ID);
                const mensagemEquipe = await canalMissoes.send({ embeds: [embedEquipe], components: [rowEquipe] });

                const embedDirecao = EmbedBuilder.from(embedEquipe).setTitle(`⚙️ Controle de Missão: ${titulo}`);
                
                const botaoEditar = new ButtonBuilder()
                    .setCustomId(`editar_${missaoId}`)
                    .setLabel('Editar')
                    .setEmoji('⚙️')
                    .setStyle(ButtonStyle.Primary);

                const botaoCancelar = new ButtonBuilder()
                    .setCustomId(`cancelar_${missaoId}`)
                    .setLabel('Cancelar')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Danger);

                const rowDirecao = new ActionRowBuilder().addComponents(botaoEditar, botaoCancelar);
                const mensagemDirecao = await interaction.user.send({ embeds: [embedDirecao], components: [rowDirecao] });

                const listaMissoes = lerMissoes();
                listaMissoes.push({
                    id: missaoId,
                    titulo,
                    setor,
                    descricao,
                    status: 'Disponível',
                    responsavelId: null,
                    msgEquipeId: mensagemEquipe.id,
                    msgDirecaoId: mensagemDirecao.id,
                    autorDirecaoId: interaction.user.id,
                    canalEntregaId: null
                });
                salvarMissoes(listaMissoes);

                await interaction.editReply({ content: '✅ Missão criada com sucesso e enviada aos canais correspondentes!' });

            } catch (error) {
                console.error('Erro ao processar criação de missão:', error);
                await interaction.editReply({ content: '❌ Erro ao enviar os cards de missão.' });
            }
        }
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('assumir_')) {
            try { await assumirBotao.execute(interaction, client); } catch (error) { console.error(error); }
        }
        else if (customId.startsWith('concluir_')) {
            try { await concluirBotao.execute(interaction, client); } catch (error) { console.error(error); }
        }
        else if (
            customId.startsWith('aprovar_sim_') || 
            customId.startsWith('aprovar_nao_') || 
            customId.startsWith('cancelar_') || 
            customId.startsWith('editar_')
        ) {
            try { await direcaoBotoes.execute(interaction, client); } catch (error) { console.error(error); }
        }
    }
});

// Faz o login usando o Token extraído do JSON
client.login(TOKEN);
    
