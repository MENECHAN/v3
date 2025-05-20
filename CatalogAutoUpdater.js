const fs = require('fs');
const fetch = require('node-fetch');

class CatalogAutoUpdater {
    constructor(client) {
        this.client = client;
        this.catalogPath = './catalog.json';
        this.setupMessageHandler();
    }

    setupMessageHandler() {
        // Listener para mensagens com anexos
        this.client.on('messageCreate', async (message) => {
            // Ignorar bots
            if (message.author.bot) return;

            // Verificar se tem anexos
            if (message.attachments.size === 0) return;

            // Verificar se usuário tem permissão (cargo admin)
            const config = require('./config.json');
            if (!message.member.roles.cache.has(config.adminRoleId)) return;

            // Processar cada anexo
            for (const attachment of message.attachments.values()) {
                if (this.isValidCatalogFile(attachment)) {
                    await this.processCatalogFile(message, attachment);
                }
            }
        });

        console.log('🔄 Auto-updater de catálogo ativo!');
    }

    isValidCatalogFile(attachment) {
        // Verificar se é um arquivo JSON
        if (!attachment.name.endsWith('.json')) return false;

        // Verificar se contém palavras-chave relacionadas ao catálogo
        const fileName = attachment.name.toLowerCase();
        return fileName.includes('catalog') || 
               fileName.includes('store') || 
               fileName.includes('items') ||
               fileName.includes('skins') ||
               fileName.includes('api') ||
               fileName.includes('lol');
    }

    async processCatalogFile(message, attachment) {
        try {
            // Reagir com emoji de processamento
            await message.react('⏳');
            console.log(`📂 Processando arquivo: ${attachment.name}`);

            // Baixar o arquivo
            const response = await fetch(attachment.url);
            const fileContent = await response.text();

            // Validar JSON
            let rawData;
            try {
                rawData = JSON.parse(fileContent);
            } catch (error) {
                throw new Error('Arquivo JSON inválido');
            }

            // Detectar e converter formato
            const converter = new CatalogFormatConverter();
            const convertedCatalog = converter.convertToBotFormat(rawData);

            if (convertedCatalog.length === 0) {
                throw new Error('Nenhum item válido encontrado no arquivo');
            }

            // Fazer backup do catálogo atual
            const backupPath = this.createBackup();

            // Salvar novo catálogo
            fs.writeFileSync(this.catalogPath, JSON.stringify(convertedCatalog, null, 2));

            // Responder com sucesso
            await this.sendSuccessMessage(message, convertedCatalog, backupPath);

            // Reagir com sucesso
            await message.react('✅');
            await message.reactions.cache.get('⏳')?.remove();

            console.log(`✅ Catálogo atualizado com ${convertedCatalog.length} skins`);

        } catch (error) {
            console.error('❌ Erro ao processar catálogo:', error);
            
            // Reagir com erro
            await message.react('❌');
            await message.reactions.cache.get('⏳')?.remove();

            // Enviar mensagem de erro
            await message.reply({
                content: `❌ **Erro ao atualizar catálogo:**\n\`\`\`${error.message}\`\`\``,
                ephemeral: true
            });
        }
    }

    createBackup() {
        if (!fs.existsSync(this.catalogPath)) return null;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `./catalog_backup_${timestamp}.json`;
        
        fs.copyFileSync(this.catalogPath, backupPath);
        console.log(`📋 Backup criado: ${backupPath}`);
        
        return backupPath;
    }

    async sendSuccessMessage(message, newCatalog, backupPath) {
        const { EmbedBuilder } = require('discord.js');

        // Estatísticas do novo catálogo
        const stats = this.getCatalogStats(newCatalog);

        const embed = new EmbedBuilder()
            .setTitle('✅ Catálogo Atualizado com Sucesso!')
            .setDescription(`O catálogo foi convertido e atualizado automaticamente.`)
            .addFields([
                { name: '📊 Total de Skins', value: newCatalog.length.toString(), inline: true },
                { name: '🏆 Raridades', value: this.formatRarities(stats.rarities), inline: true },
                { name: '💰 Preço Médio', value: `${stats.averagePrice} RP`, inline: true },
                { name: '📁 Backup', value: backupPath || 'Nenhum backup anterior', inline: false }
            ])
            .setColor('#57f287')
            .setTimestamp()
            .setFooter({ 
                text: `Atualizado por ${message.author.tag}`,
                iconURL: message.author.displayAvatarURL()
            });

        // Listar algumas skins como preview
        if (newCatalog.length > 0) {
            const preview = newCatalog.slice(0, 5).map(skin => 
                `• ${skin.name} (${skin.champion}) - ${skin.price} RP`
            ).join('\n');
            
            embed.addFields([{
                name: '🎨 Preview das Skins',
                value: preview + (newCatalog.length > 5 ? `\n... e mais ${newCatalog.length - 5} skins` : ''),
                inline: false
            }]);
        }

        await message.reply({ embeds: [embed] });
    }

    getCatalogStats(catalog) {
        const rarities = {};
        let totalPrice = 0;

        catalog.forEach(skin => {
            rarities[skin.rarity] = (rarities[skin.rarity] || 0) + 1;
            totalPrice += skin.price;
        });

        return {
            rarities,
            averagePrice: Math.round(totalPrice / catalog.length) || 0
        };
    }

    formatRarities(rarities) {
        return Object.entries(rarities)
            .map(([rarity, count]) => `${rarity}: ${count}`)
            .join('\n') || 'Nenhuma';
    }

    // Método para limpar backups antigos
    cleanupOldBackups(daysOld = 7) {
        try {
            const files = fs.readdirSync('./');
            const backupFiles = files.filter(file => file.startsWith('catalog_backup_'));
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            let cleaned = 0;
            backupFiles.forEach(file => {
                const stats = fs.statSync(file);
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(file);
                    cleaned++;
                    console.log(`🗑️ Backup antigo removido: ${file}`);
                }
            });

            if (cleaned > 0) {
                console.log(`🧹 ${cleaned} backup(s) antigo(s) removido(s)`);
            }
        } catch (error) {
            console.error('Error cleaning up backups:', error);
        }
    }

    // Comandos de gerenciamento
    async handleCatalogCommand(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'stats':
                await this.showCatalogStats(interaction);
                break;
            case 'backup':
                await this.manualBackup(interaction);
                break;
            case 'cleanup':
                await this.cleanupBackups(interaction);
                break;
            case 'prices':
                // Redirecionar para o comando de gerenciamento de preços
                await interaction.reply({
                    content: 'Use o comando `/price-manage prices` para gerenciar preços.',
                    ephemeral: true
                });
                break;
        }
    }

    async showCatalogStats(interaction) {
        try {
            if (!fs.existsSync(this.catalogPath)) {
                return await interaction.reply({
                    content: '❌ Catálogo não encontrado.',
                    ephemeral: true
                });
            }

            const catalog = JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
            const stats = this.getCatalogStats(catalog);

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle('📊 Estatísticas do Catálogo')
                .addFields([
                    { name: '🎨 Total de Skins', value: catalog.length.toString(), inline: true },
                    { name: '💰 Preço Médio', value: `${stats.averagePrice} RP`, inline: true },
                    { name: '🏷️ Raridades', value: this.formatRarities(stats.rarities), inline: false }
                ])
                .setColor('#5865f2')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error showing catalog stats:', error);
            await interaction.reply({
                content: '❌ Erro ao mostrar estatísticas.',
                ephemeral: true
            });
        }
    }

    async manualBackup(interaction) {
        try {
            const backupPath = this.createBackup();
            await interaction.reply({
                content: `✅ Backup criado: \`${backupPath}\``,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `❌ Erro ao criar backup: ${error.message}`,
                ephemeral: true
            });
        }
    }

    async cleanupBackups(interaction) {
        try {
            const days = interaction.options.getInteger('days') || 7;
            this.cleanupOldBackups(days);
            
            await interaction.reply({
                content: `✅ Limpeza de backups concluída (>${days} dias)`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `❌ Erro na limpeza: ${error.message}`,
                ephemeral: true
            });
        }
    }
}

// Conversor integrado
class CatalogFormatConverter {
    constructor() {
        // Lista completa de campeões
        this.championNames = {
            1: "Annie", 2: "Olaf", 3: "Galio", 4: "Twisted Fate", 5: "Xin Zhao",
            // ... (lista completa como no arquivo anterior)
            950: "Naafiri", 902: "Milio"
        };
    }

    convertToBotFormat(data) {
        const format = this.detectFormat(data);
        console.log(`📋 Formato detectado: ${format}`);

        switch (format) {
            case 'BOT_FORMAT':
                console.log('✅ Já está no formato correto!');
                return data;
            case 'LOL_API':
                return this.convertFromLolApi(data);
            case 'CUSTOM_FORMAT':
                return this.convertFromCustomFormat(data);
            default:
                return this.convertFromGeneric(data);
        }
    }

    detectFormat(data) {
        if (!Array.isArray(data) || data.length === 0) return 'UNKNOWN';

        const firstItem = data[0];

        // Formato do bot
        if (firstItem.hasOwnProperty('id') && 
            firstItem.hasOwnProperty('name') && 
            firstItem.hasOwnProperty('champion') && 
            firstItem.hasOwnProperty('rarity') && 
            firstItem.hasOwnProperty('price')) {
            return 'BOT_FORMAT';
        }

        // Formato da API do LoL
        if (firstItem.hasOwnProperty('itemId') && 
            firstItem.hasOwnProperty('inventoryType')) {
            return 'LOL_API';
        }

        // Formato customizado
        if (firstItem.hasOwnProperty('skin_name') || 
            firstItem.hasOwnProperty('skinName') ||
            (firstItem.hasOwnProperty('name') && firstItem.hasOwnProperty('champion'))) {
            return 'CUSTOM_FORMAT';
        }

        return 'UNKNOWN';
    }

    convertFromLolApi(data) {
        const convertedSkins = [];
        let skinId = 1;

        data.forEach(item => {
            try {
                if (item.inventoryType === "CHAMPION_SKIN") {
                    const skinData = this.extractSkinFromApi(item, skinId);
                    if (skinData) {
                        convertedSkins.push(skinData);
                        skinId++;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Erro ao processar item API ${item.itemId}: ${error.message}`);
            }
        });

        return convertedSkins;
    }

    convertFromCustomFormat(data) {
        return data.map((item, index) => ({
            id: index + 1,
            name: item.skin_name || item.skinName || item.name || "Unknown Skin",
            champion: item.champion || item.champion_name || this.guessChampionFromName(item.name),
            rarity: item.rarity || this.guessRarityFromPrice(item.price || item.cost),
            price: item.price || item.cost || 975,
            splash_art: item.splash_art || item.image || item.icon || ""
        }));
    }

    convertFromGeneric(data) {
        const convertedSkins = [];

        data.forEach((item, index) => {
            try {
                const possibleNames = [item.name, item.skin_name, item.skinName, item.title].filter(Boolean);
                const possiblePrices = [item.price, item.cost, item.rp, item.value].filter(n => typeof n === 'number');
                const possibleChampions = [item.champion, item.champion_name, item.character].filter(Boolean);

                if (possibleNames.length > 0) {
                    convertedSkins.push({
                        id: index + 1,
                        name: possibleNames[0],
                        champion: possibleChampions[0] || this.guessChampionFromName(possibleNames[0]),
                        rarity: item.rarity || this.guessRarityFromPrice(possiblePrices[0] || 975),
                        price: possiblePrices[0] || 975,
                        splash_art: item.splash_art || item.image || item.icon || ""
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Erro ao processar item ${index}: ${error.message}`);
            }
        });

        return convertedSkins;
    }

    extractSkinFromApi(item, skinId) {
        const championId = Math.floor(item.itemId / 1000);
        const championName = this.championNames[championId] || `Champion${championId}`;

        let price = 975;
        if (item.prices && item.prices.length > 0) {
            const rpPrice = item.prices.find(p => p.currency === "RP");
            if (rpPrice) price = rpPrice.cost;
        }

        let skinName = "Unknown Skin";
        if (item.localizations && item.localizations.pt_BR) {
            skinName = item.localizations.pt_BR.name;
        }

        return {
            id: skinId,
            name: skinName,
            champion: championName,
            rarity: this.guessRarityFromPrice(price),
            price: price,
            splash_art: item.iconUrl || ""
        };
    }

    guessChampionFromName(skinName) {
        if (!skinName) return "Unknown Champion";

        const championList = Object.values(this.championNames);
        for (const champion of championList) {
            if (skinName.toLowerCase().includes(champion.toLowerCase())) {
                return champion;
            }
        }

        return "Unknown Champion";
    }

    guessRarityFromPrice(price) {
        if (price >= 3250) return "Ultimate";
        if (price >= 1820) return "Legendary";
        if (price >= 1350) return "Epic";
        if (price >= 975) return "Rare";
        if (price >= 520) return "Common";
        return "Chroma";
    }
}

module.exports = CatalogAutoUpdater;