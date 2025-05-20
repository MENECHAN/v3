const fetch = require('node-fetch');

class RiotAPI {
    constructor() {
        this.baseUrl = 'https://ddragon.leagueoflegends.com/cdn';
        this.version = '14.5.1'; // Update this to latest version
    }

    async getLatestVersion() {
        try {
            const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
            const versions = await response.json();
            this.version = versions[0];
            return this.version;
        } catch (error) {
            console.error('Error fetching latest version:', error);
            return this.version;
        }
    }

    async getChampionData() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.version}/data/en_US/champion.json`);
            const data = await response.json();
            return data.data;
        } catch (error) {
            console.error('Error fetching champion data:', error);
            return null;
        }
    }

    async getSkinImageUrl(championKey, skinNum = 0) {
        try {
            const url = `${this.baseUrl}/img/champion/splash/${championKey}_${skinNum}.jpg`;
            return url;
        } catch (error) {
            console.error('Error generating skin image URL:', error);
            return null;
        }
    }

    async getChampionSkins(championName) {
        try {
            const champions = await this.getChampionData();
            const champion = Object.values(champions).find(
                champ => champ.name.toLowerCase() === championName.toLowerCase() ||
                        champ.id.toLowerCase() === championName.toLowerCase()
            );

            if (!champion) {
                return null;
            }

            const skins = champion.skins.map(skin => ({
                id: skin.id,
                name: skin.name === 'default' ? `Classic ${champion.name}` : skin.name,
                splashArt: this.getSkinImageUrl(champion.id, skin.num),
                champion: champion.name
            }));

            return skins;
        } catch (error) {
            console.error('Error fetching champion skins:', error);
            return null;
        }
    }

    async validateSummonerName(summonerName, tagLine, region = 'br1') {
        try {
            // This would require Riot API key for actual validation
            // For now, just validate format
            const nameRegex = /^[0-9A-Za-z ._]+$/;
            const tagRegex = /^[0-9A-Za-z]+$/;
            
            return nameRegex.test(summonerName) && tagRegex.test(tagLine);
        } catch (error) {
            console.error('Error validating summoner name:', error);
            return false;
        }
    }
}

module.exports = new RiotAPI();