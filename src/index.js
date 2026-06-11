const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

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

client.once('ready', () => {
    console.log(`🤖 Bot online com sucesso como: ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    // 1. Executa o comando /criar-missao (Abre o Modal)
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

    // 2. Recebe os dados enviados pelo formulário (Modal)
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
                const canalMissoes = await client.channels.fetch(process.env.CANAL_MISSOES_ID);
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

    // 3. Gerenciador de Botões (Interações)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // Ação: Membro clica em Assumir Missão
        if (customId.startsWith('assumir_')) {
            try {
                await assumirBotao.execute(interaction, client);
            } catch (error) {
                console.error('Erro no botão assumir:', error);
            }
        }
        
        // Ação: Membro clica em Concluir Missão (dentro do canal privado)
        else if (customId.startsWith('concluir_')) {
            try {
                await concluirBotao.execute(interaction, client);
            } catch (error) {
                console.error('Erro no botão concluir:', error);
            }
        }

        // Ações da Direção: Aprovar, Recusar, Editar ou Cancelar
        else if (
            customId.startsWith('aprovar_sim_') || 
            customId.startsWith('aprovar_nao_') || 
            customId.startsWith('cancelar_') || 
            customId.startsWith('editar_')
        ) {
            try {
                await direcaoBotoes.execute(interaction, client);
            } catch (error) {
                console.error('Erro nos botões da direção:', error);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
                     
