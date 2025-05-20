const fs = require('fs');
const path = require('path');

// Path para o arquivo de configuração
const CONFIG_FILE_PATH = path.resolve(__dirname, './price-config.json');

class PriceManager {
    constructor() {
        this.config = this.loadConfig();
        this.currency = this.config.currency || 'RP';
    }

    loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE_PATH)) {
                const rawData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
                const parsedConfig = JSON.parse(rawData);
                
                // Garantir estruturas necessárias
                parsedConfig.currency = parsedConfig.currency || 'RP';
                parsedConfig.defaultPrices = parsedConfig.defaultPrices || {};
                parsedConfig.defaultPrices.inventoryTypes = parsedConfig.defaultPrices.inventoryTypes || {};
                parsedConfig.defaultPrices.itemCategories = parsedConfig.defaultPrices.itemCategories || {};
                parsedConfig.defaultPrices.subInventoryTypes = parsedConfig.defaultPrices.subInventoryTypes || {};
                parsedConfig.itemOverrides = parsedConfig.itemOverrides || {};
                parsedConfig.fallbackPrice = parsedConfig.fallbackPrice !== undefined ? parsedConfig.fallbackPrice : 0;
                parsedConfig.priceMultipliers = parsedConfig.priceMultipliers || {};
                parsedConfig.categoryPriority = parsedConfig.categoryPriority || [
                    'itemOverrides',
                    'itemCategories', 
                    'subInventoryTypes',
                    'inventoryTypes',
                    'fallbackPrice'
                ];
                
                return parsedConfig;
            } else {
                console.warn(`Arquivo de configuração de preços não encontrado em ${CONFIG_FILE_PATH}. Criando um padrão.`);
                const defaultConfig = this.getDefaultConfig();
                fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
                return defaultConfig;
            }
        } catch (error) {
            console.error('Erro ao carregar configuração de preços:', error);
            return this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            currency: "RP",
            defaultPrices: {
                inventoryTypes: {
                    "CHAMPION": 585,
                    "CHAMPION_SKIN": 975,
                    "BUNDLES": 1200,
                    "WARD_SKIN": 640,
                    "SUMMONER_ICON": 250,
                    "EMOTE": 350
                },
                itemCategories: {
                    "ULTIMATE_SKIN": 3250,
                    "LEGENDARY_SKIN": 1820,
                    "EPIC_SKIN": 1350,
                    "RARE_SKIN": 975,
                    "COMMON_SKIN": 750,
                    "BUDGET_SKIN": 520,
                    "CHROMA": 290,
                    "CHAMPION": 585
                },
                subInventoryTypes: {
                    "RECOLOR": 290,
                    "CHEST": 125
                }
            },
            itemOverrides: {},
            fallbackPrice: 0,
            priceMultipliers: {
                "PRESTIGE": 1.5,
                "MYTHIC": 2.0,
                "LIMITED_EDITION": 1.3,
                "LEGACY": 1.1
            },
            categoryPriority: [
                'itemOverrides',
                'itemCategories', 
                'subInventoryTypes',
                'inventoryTypes',
                'fallbackPrice'
            ]
        };
    }

    saveConfig() {
        try {
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(this.config, null, 2), 'utf8');
            console.log('Configuração de preços salva com sucesso.');
            // Recarregar config para garantir estado atualizado
            this.config = this.loadConfig();
        } catch (error) {
            console.error('Erro ao salvar configuração de preços:', error);
        }
    }

    /**
     * Obtém o preço para um item
     * @param {Object} item - Objeto do item com propriedades relevantes
     * @returns {number} - Preço em RP
     */
    getItemPrice(item) {
        if (!item) return this.config.fallbackPrice;

        const itemKey = String(item.itemKey || item.itemId || item.id);
        let price = 0;
        let foundBy = null;

        // Seguir prioridade definida na configuração
        for (const category of this.config.categoryPriority) {
            switch (category) {
                case 'itemOverrides':
                    if (this.config.itemOverrides[itemKey] !== undefined) {
                        price = this.config.itemOverrides[itemKey];
                        foundBy = 'itemOverrides';
                        break;
                    }
                    break;

                case 'itemCategories':
                    if (item.itemCategory && this.config.defaultPrices.itemCategories[item.itemCategory] !== undefined) {
                        price = this.config.defaultPrices.itemCategories[item.itemCategory];
                        foundBy = 'itemCategories';
                        break;
                    }
                    // Tentar categoria alternativa se existir
                    if (item.category && this.config.defaultPrices.itemCategories[item.category] !== undefined) {
                        price = this.config.defaultPrices.itemCategories[item.category];
                        foundBy = 'itemCategories';
                        break;
                    }
                    break;

                case 'subInventoryTypes':
                    if (item.subInventoryType && this.config.defaultPrices.subInventoryTypes[item.subInventoryType] !== undefined) {
                        price = this.config.defaultPrices.subInventoryTypes[item.subInventoryType];
                        foundBy = 'subInventoryTypes';
                        break;
                    }
                    break;

                case 'inventoryTypes':
                    if (item.inventoryType && this.config.defaultPrices.inventoryTypes[item.inventoryType] !== undefined) {
                        price = this.config.defaultPrices.inventoryTypes[item.inventoryType];
                        foundBy = 'inventoryTypes';
                        break;
                    }
                    break;

                case 'fallbackPrice':
                    if (price === 0) {
                        price = this.config.fallbackPrice;
                        foundBy = 'fallbackPrice';
                    }
                    break;
            }

            if (price > 0) break;
        }

        // Aplicar multiplicadores se aplicável
        price = this.applyMultipliers(price, item);

        return Math.max(0, Math.round(price));
    }

    /**
     * Aplica multiplicadores baseados nas tags/características do item
     */
    applyMultipliers(basePrice, item) {
        let finalPrice = basePrice;

        if (!this.config.priceMultipliers || !item) return finalPrice;

        // Verificar tags do item
        if (item.tags && Array.isArray(item.tags)) {
            for (const tag of item.tags) {
                const upperTag = tag.toUpperCase();
                if (this.config.priceMultipliers[upperTag]) {
                    finalPrice *= this.config.priceMultipliers[upperTag];
                }
            }
        }

        // Verificar propriedades específicas
        if (item.rarity && this.config.priceMultipliers[item.rarity.toUpperCase()]) {
            finalPrice *= this.config.priceMultipliers[item.rarity.toUpperCase()];
        }

        if (item.type && this.config.priceMultipliers[item.type.toUpperCase()]) {
            finalPrice *= this.config.priceMultipliers[item.type.toUpperCase()];
        }

        return finalPrice;
    }

    /**
     * Define preço para item específico
     */
    setItemPrice(itemKey, price) {
        if (!this.config.itemOverrides) {
            this.config.itemOverrides = {};
        }
        const keyStr = String(itemKey);

        if (price === null || price === undefined) {
            delete this.config.itemOverrides[keyStr];
            console.log(`Override de preço para item '${keyStr}' removido.`);
        } else {
            const numPrice = parseInt(price, 10);
            if (isNaN(numPrice) || numPrice < 0) {
                console.error(`Preço inválido para setItemPrice: ${price}. Deve ser um número não negativo.`);
                return false;
            }
            this.config.itemOverrides[keyStr] = numPrice;
            console.log(`Override de preço para item '${keyStr}' definido para ${numPrice} ${this.currency}.`);
        }
        this.saveConfig();
        return true;
    }

    /**
     * Define preço padrão para uma classe de itens
     */
    setClassPrice(classSystem, className, price) {
        if (!['inventoryTypes', 'itemCategories', 'subInventoryTypes'].includes(classSystem)) {
            console.error(`Sistema de classe inválido: ${classSystem}`);
            return false;
        }
        if (!this.config.defaultPrices[classSystem]) {
            this.config.defaultPrices[classSystem] = {};
        }

        if (price === null || price === undefined) {
            delete this.config.defaultPrices[classSystem][className];
            console.log(`Preço padrão para classe '${classSystem}.${className}' removido.`);
        } else {
            const numPrice = parseInt(price, 10);
            if (isNaN(numPrice) || numPrice < 0) {
                console.error(`Preço inválido para setClassPrice: ${price}. Deve ser um número não negativo.`);
                return false;
            }
            this.config.defaultPrices[classSystem][className] = numPrice;
            console.log(`Preço padrão para classe '${classSystem}.${className}' definido para ${numPrice} ${this.currency}.`);
        }
        this.saveConfig();
        return true;
    }

    /**
     * Define multiplicador de preço
     */
    setMultiplier(multiplierName, value) {
        if (!this.config.priceMultipliers) {
            this.config.priceMultipliers = {};
        }

        if (value === null || value === undefined) {
            delete this.config.priceMultipliers[multiplierName.toUpperCase()];
            console.log(`Multiplicador '${multiplierName}' removido.`);
        } else {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                console.error(`Multiplicador inválido: ${value}. Deve ser um número não negativo.`);
                return false;
            }
            this.config.priceMultipliers[multiplierName.toUpperCase()] = numValue;
            console.log(`Multiplicador '${multiplierName}' definido para ${numValue}.`);
        }
        this.saveConfig();
        return true;
    }

    /**
     * Aplica preços para todo o catálogo
     */
    async applyCatalogPrices(catalogPath = './catalog.json') {
        try {
            if (!fs.existsSync(catalogPath)) {
                console.error(`Catálogo não encontrado: ${catalogPath}`);
                return false;
            }

            const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
            let updated = 0;

            catalog.forEach(item => {
                const newPrice = this.getItemPrice(item);
                if (item.price !== newPrice) {
                    item.price = newPrice;
                    updated++;
                }
            });

            // Salvar catálogo atualizado
            fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
            console.log(`✅ Preços aplicados a ${updated} itens do catálogo.`);
            return true;

        } catch (error) {
            console.error('Erro ao aplicar preços ao catálogo:', error);
            return false;
        }
    }

    /**
     * Valida configuração atual
     */
    validateConfig() {
        const errors = [];

        // Validar estrutura básica
        if (!this.config.defaultPrices) {
            errors.push('defaultPrices missing');
        }

        if (!this.config.currency) {
            errors.push('currency missing');
        }

        // Validar preços numéricos
        const checkPrices = (obj, path = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object') {
                    checkPrices(value, `${path}${key}.`);
                } else if (typeof value === 'number') {
                    if (value < 0) {
                        errors.push(`Negative price at ${path}${key}: ${value}`);
                    }
                } else if (value !== null && value !== undefined) {
                    errors.push(`Invalid price type at ${path}${key}: ${typeof value}`);
                }
            }
        };

        checkPrices(this.config.defaultPrices, 'defaultPrices.');
        checkPrices(this.config.itemOverrides, 'itemOverrides.');

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Retorna cópia da configuração atual
     */
    getAllPriceConfigs() {
        return JSON.parse(JSON.stringify(this.config));
    }

    /**
     * Retorna sistemas de classe válidos
     */
    getValidClassSystems() {
        return ['inventoryTypes', 'itemCategories', 'subInventoryTypes'];
    }

    /**
     * Retorna nomes de classe para um sistema específico
     */
    getValidClassNamesForSystem(classSystem) {
        if (this.config.defaultPrices && this.config.defaultPrices[classSystem]) {
            return Object.keys(this.config.defaultPrices[classSystem]);
        }
        return [];
    }

    /**
     * Gera relatório de estatísticas de preços
     */
    generatePriceReport(catalog = null) {
        const report = {
            totalOverrides: Object.keys(this.config.itemOverrides).length,
            totalCategories: Object.keys(this.config.defaultPrices.itemCategories || {}).length,
            totalInventoryTypes: Object.keys(this.config.defaultPrices.inventoryTypes || {}).length,
            totalSubTypes: Object.keys(this.config.defaultPrices.subInventoryTypes || {}).length,
            totalMultipliers: Object.keys(this.config.priceMultipliers || {}).length,
            currency: this.currency,
            fallbackPrice: this.config.fallbackPrice
        };

        if (catalog) {
            // Analisar catálogo se fornecido
            const priceDistribution = {};
            const categoryStats = {};

            catalog.forEach(item => {
                const price = this.getItemPrice(item);
                const priceRange = this.getPriceRange(price);
                priceDistribution[priceRange] = (priceDistribution[priceRange] || 0) + 1;

                const category = item.category || item.itemCategory || 'UNKNOWN';
                categoryStats[category] = (categoryStats[category] || 0) + 1;
            });

            report.catalogStats = {
                totalItems: catalog.length,
                priceDistribution,
                categoryStats
            };
        }

        return report;
    }

    getPriceRange(price) {
        if (price === 0) return 'FREE';
        if (price < 500) return '0-499';
        if (price < 1000) return '500-999';
        if (price < 1500) return '1000-1499';
        if (price < 2000) return '1500-1999';
        if (price < 3000) return '2000-2999';
        return '3000+';
    }
}

// Exportar instância singleton
module.exports = new PriceManager();