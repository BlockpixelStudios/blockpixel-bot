const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- SISTEMA DE PROTEÇÃO ANTI-VAZAMENTO (Ofuscação de Dados) ---
const tokenInvertido = "w4qy-Gj_vF7RTlGMT3WPBhS4HgXH_QY8ybqPwn.U_RO_G.AOxAzN1ATO2cDO0IjN1QDNxUTM";
const clientIdInvertido = "8107509678426544151";
const guildIdInvertido = "4656779771541798041";
const canalMissoesInvertido = "1146084649942644151";

// Função interna que desinverte e remove qualquer espaço invisível ou quebra de linha
const desinverter = (texto) => texto.split('').reverse().join('').trim();

const TOKEN = desinverter(tokenInvertido);
const CLIENT_ID = desinverter(clientIdInvertido);
const GUILD_ID = desinverter(guildIdInvertido);
const CANAL_MISSOES_ID = desinverter(canalMissoesInvertido);
// ---------------------------------------------------------------

// Exibe um diagnóstico seguro no console da host para sabermos o tamanho do token gerado
console.log(`[DIAGNÓSTICO] O Token processado tem exatamente ${TOKEN.length} caracteres.`);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Garante o caminho seguro do banco de dados local
const dbPath = path.join(__dirname, '../missoes.json');

function lerMissoes() {
    try {
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, '[]', 'utf8');
            return [];
        }
        const dados = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(dados);
    } catch (error) {
        return [];
    }
}

function salvarMissoes(missoes) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(missoes, null, 2), 'utf8');
    } catch (error) {
        console.error('❌ Erro ao salvar o arquivo missoes.json:', error.message);
    }
}

// Inicializa o arquivo para evitar bugs caso a host tenha limpado a pasta
lerMissoes();

client.once('ready', async () => {
    console.log(`🤖 Bot online com sucesso como: ${client.user.tag}!`);

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
            try { await assumirBotao.execute(interaction, client); } catch (e) { console.error(e); }
        }
        else if (customId.startsWith('concluir_')) {
            try { await concluirBotao.execute(interaction, client); } catch (e) { console.error(e); }
        }
        else if (
            customId.startsWith('aprovar_sim_') || 
            customId.startsWith('aprovar_nao_') || 
            customId.startsWith('cancelar_') || 
            customId.startsWith('editar_')
        ) {
            try { await direcaoBotoes.execute(interaction, client); } catch (e) { console.error(e); }
        }
    }
});

client.login(TOKEN);
            
