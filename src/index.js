const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Importa o comando de criar missão
const criarMissaoComando = require('./commands/criar-missao.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Caminho do arquivo de banco de dados local
const dbPath = path.join(__dirname, '../missoes.json');

// Função auxiliar para ler as missões com segurança
function lerMissoes() {
    try {
        const dados = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(dados);
    } catch (error) {
        return [];
    }
}

// Função auxiliar para salvar as missões
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
            await interaction.deferReply({ ephemeral: true }); // Evita que a interação expire no celular

            const titulo = interaction.fields.getTextInputValue('missao_titulo');
            const setor = interaction.fields.getTextInputValue('missao_setor');
            const descricao = interaction.fields.getTextInputValue('missao_descricao');
            const missaoId = `m_${Date.now()}`; // Gera um ID único baseado no tempo atual

            // Criando o Card (Embed) da Missão para a Equipe
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

            // Botão para a equipe assumir a missão
            const botaoAssumir = new ButtonBuilder()
                .setCustomId(`assumir_${missaoId}`)
                .setLabel('Assumir Missão')
                .setEmoji('⚔️')
                .setStyle(ButtonStyle.Success);

            const rowEquipe = new ActionRowBuilder().addComponents(botaoAssumir);

            try {
                // Envia no canal de missões público da equipe
                const canalMissoes = await client.channels.fetch(process.env.CANAL_MISSOES_ID);
                const mensagemEquipe = await canalMissoes.send({ embeds: [embedEquipe], components: [rowEquipe] });

                // Criando o Card para a DM da Direção (com botões de Editar e Cancelar)
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

                // Envia na DM de quem criou a missão (membro da Direção)
                const mensagemDirecao = await interaction.user.send({ embeds: [embedDirecao], components: [rowDirecao] });

                // Salva a nova missão no arquivo JSON local
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
                await interaction.editReply({ content: '❌ Erro ao enviar os cards de missão. Verifique se os IDs no .env estão corretos e se as Direct Messages estão abertas.' });
            }
        }
    }

    // 3. Próximo passo: Escutar os cliques dos botões (Assumir, Concluir, etc.)
});

client.login(process.env.DISCORD_TOKEN);
                    
