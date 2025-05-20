const fs = require('fs');
const path = require('path');

class CatalogProcessor {
    constructor() {
        this.catalogPath = './catalog.json';
        this.championNames = this.loadChampionMapping();
    }

    loadChampionMapping() {
        // Mapeamento de ID de campeão para nome
        return {
            1: "Annie", 2: "Olaf", 3: "Galio", 4: "Twisted Fate", 5: "Xin Zhao",
            6: "Urgot", 7: "LeBlanc", 8: "Vladimir", 9: "Fiddlesticks", 10: "Kayle",
            11: "Master Yi", 12: "Alistar", 13: "Ryze", 14: "Sion", 15: "Sivir",
            16: "Soraka", 17: "Teemo", 18: "Tristana", 19: "Warwick", 20: "Nunu & Willump",
            21: "Miss Fortune", 22: "Ashe", 23: "Tryndamere", 24: "Jax", 25: "Morgana",
            26: "Zilean", 27: "Singed", 28: "Evelynn", 29: "Twitch", 30: "Karthus",
            31: "Cho'Gath", 32: "Amumu", 33: "Rammus", 34: "Anivia", 35: "Shaco",
            36: "Dr. Mundo", 37: "Sona", 38: "Kassadin", 39: "Irelia", 40: "Janna",
            41: "Gangplank", 42: "Corki", 43: "Karma", 44: "Taric", 45: "Veigar",
            48: "Trundle", 50: "Swain", 51: "Caitlyn", 53: "Blitzcrank", 54: "Malphite",
            55: "Katarina", 56: "Nocturne", 57: "Maokai", 58: "Renekton", 59: "Jarvan IV",
            60: "Elise", 61: "Orianna", 62: "Wukong", 63: "Brand", 64: "Lee Sin",
            67: "Vayne", 68: "Rumble", 69: "Cassiopeia", 72: "Skarner", 74: "Heimerdinger",
            75: "Nasus", 76: "Nidalee", 77: "Udyr", 78: "Poppy", 79: "Gragas",
            80: "Pantheon", 81: "Ezreal", 82: "Mordekaiser", 83: "Yorick", 84: "Akali",
            85: "Kennen", 86: "Garen", 89: "Leona", 90: "Malzahar", 91: "Talon",
            92: "Riven", 96: "Kog'Maw", 98: "Shen", 99: "Lux", 101: "Xerath",
            102: "Shyvana", 103: "Ahri", 104: "Graves", 105: "Fizz", 106: "Volibear",
            107: "Rengar", 110: "Varus", 111: "Nautilus", 112: "Viktor", 113: "Sejuani",
            114: "Fiora", 115: "Ziggs", 117: "Lulu", 119: "Draven", 120: "Hecarim",
            121: "Kha'Zix", 122: "Darius", 126: "Jayce", 127: "Lissandra", 131: "Diana",
            133: "Quinn", 134: "Syndra", 136: "Aurelion Sol", 141: "Kayn", 142: "Zoe",
            143: "Zyra", 145: "Kai'Sa", 147: "Seraphine", 150: "Gnar", 154: "Zac",
            157: "Yasuo", 161: "Vel'Koz", 163: "Taliyah", 164: "Camille", 166: "Akshan",
            200: "Bel'Veth", 201: "Braum", 202: "Jhin", 203: "Kindred", 221: "Zeri",
            222: "Jinx", 223: "Tahm Kench", 234: "Viego", 235: "Senna", 236: "Lucian",
            238: "Zed", 240: "Kled", 245: "Ekko", 246: "Qiyana", 254: "Vi",
            266: "Aatrox", 267: "Nami", 268: "Azir", 350: "Yuumi", 360: "Samira",
            412: "Thresh", 420: "Illaoi", 421: "Rek'Sai", 427: "Ivern", 429: "Kalista",
            432: "Bard", 516: "Ornn", 517: "Sylas", 518: "Neeko", 523: "Aphelios",
            526: "Rell", 555: "Pyke", 711: "Vex", 777: "Yone", 875: "Sett",
            876: "Lillia", 887: "Gwen", 888: "Renata Glasc", 895: "Nilah", 897: "K'Sante",
            901: "Smolder", 910: "Hwei", 950: "Naafiri", 902: "Milio"
        };
    }

    // Processar catálogo da API do Riot
    processRiotCatalog(rawCatalog) {
        console.log('🔄 Processando catálogo da API do Riot...');
        
        const processedItems = [];
        let id = 1;

        rawCatalog.forEach(item => {
            try {
                const processedItem = this.processRiotItem(item, id);
                if (processedItem) {
                    processedItems.push(processedItem);
                    id++;
                }
            } catch (error) {
                console.warn(`⚠️ Erro ao processar item ${item.itemId}: ${error.message}`);
            }
        });

        return processedItems;
    }

    processRiotItem(item, id) {
        // Extrair informações básicas
        const itemId = item.itemId;
        const inventoryType = item.inventoryType;
        const subInventoryType = item.subInventoryType || null;

        // Obter nome localizado
        const name = this.getLocalizedName(item);
        
        // Determinar categoria e tipo
        const category = this.determineCategory(item);
        const type = this.determineType(item);
        
        // Obter preço
        const price = this.getPrice(item);
        
        // Obter informações do campeão (se aplicável)
        const championInfo = this.getChampionInfo(item);

        // Criar item processado
        return {
            id: id,
            originalId: itemId,
            name: name,
            category: category,
            type: type,
            inventoryType: inventoryType,
            subInventoryType: subInventoryType,
            champion: championInfo.name,
            championId: championInfo.id,
            price: price,
            rarity: this.getRarityFromPrice(price),
            iconUrl: item.iconUrl || null,
            splashArt: this.getSplashArt(item, championInfo),
            releaseDate: item.releaseDate || null,
            active: item.active !== false,
            tags: this.generateTags(item, championInfo)
        };
    }

    getLocalizedName(item) {
        // Prioridade: pt_BR > en_US > nome padrão
        if (item.localizations?.pt_BR?.name) {
            return item.localizations.pt_BR.name;
        }
        if (item.localizations?.en_US?.name) {
            return item.localizations.en_US.name;
        }
        return `Item ${item.itemId}`;
    }

    determineCategory(item) {
        const inventoryType = item.inventoryType;
        const subInventoryType = item.subInventoryType || '';
        const itemId = item.itemId;

        switch (inventoryType) {
            case 'CHAMPION_SKIN':
                // Verificar se é chroma
                if (subInventoryType === 'RECOLOR' || this.isChroma(itemId)) {
                    return 'CHROMA';
                }
                return 'SKIN';

            case 'CHAMPION':
                return 'CHAMPION';

            case 'BUNDLES':
                if (subInventoryType === 'CHROMA_BUNDLE') {
                    return 'CHROMA_BUNDLE';
                }
                return 'BUNDLE';

            case 'WARD_SKIN':
                return 'WARD';

            case 'SUMMONER_ICON':
                return 'ICON';

            case 'EMOTE':
                return 'EMOTE';

            default:
                return 'OTHER';
        }
    }

    determineType(item) {
        const category = this.determineCategory(item);
        const price = this.getPrice(item);

        if (category === 'SKIN') {
            // Classificar skin por preço
            if (price >= 3250) return 'Ultimate';
            if (price >= 1820) return 'Legendary';
            if (price >= 1350) return 'Epic';
            if (price >= 975) return 'Rare';
            if (price >= 520) return 'Common';
            return 'Budget';
        }

        return category.toLowerCase();
    }

    isChroma(itemId) {
        // Chromas geralmente têm IDs com padrão específico
        const skinNumber = itemId % 1000;
        return skinNumber >= 100; // Número arbitrário baseado na observação
    }

    getPrice(item) {
        if (!item.prices || !Array.isArray(item.prices)) {
            return 0;
        }

        // Priorizar RP, depois outras moedas
        const rpPrice = item.prices.find(p => p.currency === 'RP');
        if (rpPrice && rpPrice.cost) {
            return rpPrice.cost;
        }

        const ipPrice = item.prices.find(p => p.currency === 'IP' || p.currency === 'BE');
        if (ipPrice && ipPrice.cost) {
            return Math.round(ipPrice.cost / 10); // Conversão aproximada IP->RP
        }

        return 0;
    }

    getChampionInfo(item) {
        // Tentar extrair do itemId
        if (item.inventoryType === 'CHAMPION_SKIN' || item.inventoryType === 'CHAMPION') {
            const championId = Math.floor(item.itemId / 1000);
            const championName = this.championNames[championId];
            
            if (championName) {
                return { id: championId, name: championName };
            }
        }

        // Tentar extrair do nome
        const name = this.getLocalizedName(item);
        for (const [id, champName] of Object.entries(this.championNames)) {
            if (name.toLowerCase().includes(champName.toLowerCase())) {
                return { id: parseInt(id), name: champName };
            }
        }

        return { id: null, name: null };
    }

    getRarityFromPrice(price) {
        if (price >= 3250) return 'Ultimate';
        if (price >= 1820) return 'Legendary';
        if (price >= 1350) return 'Epic';
        if (price >= 975) return 'Rare';
        if (price >= 520) return 'Common';
        if (price > 0) return 'Budget';
        return 'Free';
    }

    getSplashArt(item, championInfo) {
        // Se tem URL própria, usar essa
        if (item.iconUrl && item.iconUrl.includes('splash')) {
            return item.iconUrl;
        }

        // Gerar URL baseada no campeão e skin
        if (championInfo.name && item.inventoryType === 'CHAMPION_SKIN') {
            const skinNumber = item.itemId % 1000;
            const championKey = championInfo.name.replace(/[^a-zA-Z]/g, '');
            return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_${skinNumber}.jpg`;
        }

        return item.iconUrl || null;
    }

    generateTags(item, championInfo) {
        const tags = [];
        
        // Adicionar categoria
        tags.push(this.determineCategory(item).toLowerCase());
        
        // Adicionar nome do campeão
        if (championInfo.name) {
            tags.push(championInfo.name.toLowerCase());
        }
        
        // Adicionar palavras do nome
        const name = this.getLocalizedName(item);
        const nameWords = name.toLowerCase().split(/\s+/);
        tags.push(...nameWords.filter(word => word.length > 2));
        
        // Adicionar raridade
        const rarity = this.getRarityFromPrice(this.getPrice(item));
        tags.push(rarity.toLowerCase());

        return [...new Set(tags)]; // Remover duplicatas
    }

    // Salvar catálogo processado
    saveCatalog(processedItems) {
        // Fazer backup do catálogo atual
        if (fs.existsSync(this.catalogPath)) {
            const backupPath = `${this.catalogPath}.backup.${Date.now()}`;
            fs.copyFileSync(this.catalogPath, backupPath);
            console.log(`📋 Backup criado: ${backupPath}`);
        }

        // Salvar novo catálogo
        fs.writeFileSync(this.catalogPath, JSON.stringify(processedItems, null, 2));
        console.log(`✅ Catálogo salvo: ${processedItems.length} itens processados`);

        // Gerar estatísticas
        this.generateStats(processedItems);
    }

    generateStats(items) {
        const stats = {
            total: items.length,
            categories: {},
            types: {},
            champions: {},
            priceRanges: {
                free: 0,
                budget: 0,
                common: 0,
                rare: 0,
                epic: 0,
                legendary: 0,
                ultimate: 0
            }
        };

        items.forEach(item => {
            // Contar categorias
            stats.categories[item.category] = (stats.categories[item.category] || 0) + 1;
            
            // Contar tipos
            stats.types[item.type] = (stats.types[item.type] || 0) + 1;
            
            // Contar campeões
            if (item.champion) {
                stats.champions[item.champion] = (stats.champions[item.champion] || 0) + 1;
            }
            
            // Contar faixas de preço
            if (item.price === 0) stats.priceRanges.free++;
            else if (item.price < 520) stats.priceRanges.budget++;
            else if (item.price < 975) stats.priceRanges.common++;
            else if (item.price < 1350) stats.priceRanges.rare++;
            else if (item.price < 1820) stats.priceRanges.epic++;
            else if (item.price < 3250) stats.priceRanges.legendary++;
            else stats.priceRanges.ultimate++;
        });

        console.log('\n📊 ESTATÍSTICAS DO CATÁLOGO:');
        console.log(`Total de itens: ${stats.total}`);
        console.log('Categorias:', stats.categories);
        console.log('Faixas de preço:', stats.priceRanges);

        // Salvar estatísticas
        fs.writeFileSync('./catalog-stats.json', JSON.stringify(stats, null, 2));
    }

    // Método principal para converter
    async convertCatalog(inputFile, outputFile = null) {
        try {
            console.log(`🔄 Iniciando conversão: ${inputFile}`);
            
            // Ler arquivo de entrada
            const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
            
            if (!Array.isArray(rawData)) {
                throw new Error('Arquivo deve conter um array de itens');
            }

            // Processar itens
            const processedItems = this.processRiotCatalog(rawData);
            
            // Salvar resultado
            if (outputFile) {
                fs.writeFileSync(outputFile, JSON.stringify(processedItems, null, 2));
                console.log(`✅ Catálogo convertido salvo em: ${outputFile}`);
            } else {
                this.saveCatalog(processedItems);
            }

            return processedItems;

        } catch (error) {
            console.error('❌ Erro na conversão:', error);
            throw error;
        }
    }

    // Método para uso via linha de comando
    static async run() {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log(`
🔄 Processador de Catálogo LoL

Uso: node CatalogProcessor.js [arquivo-entrada] [arquivo-saida]

Exemplos:
  node CatalogProcessor.js riot-catalog.json
  node CatalogProcessor.js riot-catalog.json catalog-processado.json

O script irá:
1. Ler o catálogo da API do Riot
2. Processar e categorizar todos os itens
3. Aplicar preços e raridades
4. Gerar catálogo compatível com o bot
5. Criar estatísticas detalhadas
            `);
            return;
        }

        const inputFile = args[0];
        const outputFile = args[1];
        
        if (!fs.existsSync(inputFile)) {
            console.error(`❌ Arquivo não encontrado: ${inputFile}`);
            return;
        }

        const processor = new CatalogProcessor();
        await processor.convertCatalog(inputFile, outputFile);
    }
}

// Se executado diretamente
if (require.main === module) {
    CatalogProcessor.run().catch(console.error);
}

module.exports = CatalogProcessor;