
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config.json');

module.exports = {
    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }

        // Create main panel embed
        const embed = new EmbedBuilder()
            .setTitle('🛍️ LoL Shop - Painel Principal')
            .setDescription('**Bem-vindo ao nosso shop de skins do League of Legends!**\n\n' +
                '🛒 **Open Cart**: Abra seu carrinho para comprar skins\n' +
                '👥 **Add Account**: Adicione uma conta para receber as skins\n\n' +
                '⚡ Processo rápido e seguro\n' +
                '💎 Melhores preços do mercado\n' +
                '🎮 Entrega garantida')
            .setColor('#5865f2')
            .setThumbnail('https://i.imgur.com/QIc8Sk0.png')
            .setFooter({
                text: 'LoL Shop Bot',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Create buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_cart_region')
                    .setLabel('🛒 Open Cart')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('add_account')
                    .setLabel('👥 Add Account')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Get the channel
        const channel = interaction.guild.channels.cache.get(config.orderPanelChannelId);

        if (!channel) {
            return await interaction.reply({
                content: '❌ Canal do painel não encontrado.',
                ephemeral: true
            });
        }

        try {
            await channel.send({
                embeds: [embed],
                components: [row]
            });

            await interaction.reply({
                content: '✅ Painel enviado com sucesso!',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error sending panel:', error);
            await interaction.reply({
                content: '❌ Erro ao enviar o painel.',
                ephemeral: true
            });
        }
    }
};