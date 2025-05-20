const { EmbedBuilder } = require('discord.js');

class EmbedUtils {
    static createSuccessEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`✅ ${title}`)
            .setDescription(description)
            .setColor('#57f287')
            .setTimestamp();
    }

    static createErrorEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`❌ ${title}`)
            .setDescription(description)
            .setColor('#ed4245')
            .setTimestamp();
    }

    static createWarningEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`⚠️ ${title}`)
            .setDescription(description)
            .setColor('#faa61a')
            .setTimestamp();
    }

    static createInfoEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`ℹ️ ${title}`)
            .setDescription(description)
            .setColor('#5865f2')
            .setTimestamp();
    }

    static createLoadingEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`⏳ ${title}`)
            .setDescription(description)
            .setColor('#9b59b6')
            .setTimestamp();
    }

    static createShopEmbed() {
        return new EmbedBuilder()
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
                iconURL: null // Will be set by the caller
            })
            .setTimestamp();
    }

    static createAccountListEmbed(accounts) {
        const embed = new EmbedBuilder()
            .setTitle('👥 Selecione uma Conta')
            .setDescription('**Escolha uma conta para adicionar como amigo:**\n\n' +
                          'Clique no botão "Add Friend" da conta desejada.')
            .setColor('#5865f2')
            .setTimestamp();

        const accountFields = accounts.map(account => ({
            name: `🎮 ${account.nickname}`,
            value: `**RP:** ${account.rp_amount.toLocaleString()}\n` +
                   `**Amigos:** ${account.friends_count}/${account.max_friends}`,
            inline: true
        }));

        embed.addFields(accountFields);
        return embed;
    }

    static createSkinPreviewEmbed(skin) {
        return new EmbedBuilder()
            .setTitle('🎨 Preview da Skin')
            .setDescription(`**${skin.name}**\n\n` +
                          `**Campeão:** ${skin.champion}\n` +
                          `**Raridade:** ${skin.rarity}\n` +
                          `**Preço:** ${skin.price} RP (${(skin.price * 0.01).toFixed(2)}€)`)
            .setColor('#5865f2')
            .setImage(skin.splash_art)
            .setTimestamp();
    }

    static createSearchResultsEmbed(searchQuery, filteredSkins, currentPage, totalPages) {
        return new EmbedBuilder()
            .setTitle('🔍 Resultados da Pesquisa')
            .setDescription(`**Pesquisa:** ${searchQuery}\n` +
                          `**Resultados:** ${filteredSkins.length} skin(s) encontrada(s)\n` +
                          `**Página:** ${currentPage}/${totalPages}\n\n` +
                          'Selecione uma skin no menu abaixo:')
            .setColor('#5865f2')
            .setTimestamp();
    }

    static createNoResultsEmbed(searchQuery) {
        return new EmbedBuilder()
            .setTitle('🔍 Nenhum Resultado')
            .setDescription(`Nenhuma skin encontrada para: **${searchQuery}**\n\n` +
                          'Tente pesquisar por:\n' +
                          '• Nome do campeão\n' +
                          '• Nome da skin\n' +
                          '• Palavras-chave')
            .setColor('#ed4245')
            .setTimestamp();
    }

    static createSearchInstructionsEmbed() {
        return new EmbedBuilder()
            .setTitle('🔍 Pesquisar Skins')
            .setDescription('**Como pesquisar:**\n\n' +
                          '• Digite o nome do campeão ou da skin\n' +
                          '• Use palavras-chave em português ou inglês\n' +
                          '• Seja específico para melhores resultados\n\n' +
                          'Clique no botão "Search" para começar!')
            .setColor('#5865f2')
            .setTimestamp();
    }
}

module.exports = EmbedUtils;