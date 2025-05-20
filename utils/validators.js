class Validators {
    static validateRiotTag(input) {
        // Validate format: Username#TAG
        const regex = /^.+#[a-zA-Z0-9]{2,5}$/;
        return regex.test(input);
    }

    static validateRiotUsername(username) {
        // Username can contain letters, numbers, spaces and some special characters
        const regex = /^[a-zA-Z0-9 ._\-]+$/;
        return regex.test(username) && username.length >= 3 && username.length <= 16;
    }

    static validateRiotTagLine(tagLine) {
        // Tag line is 2-5 alphanumeric characters
        const regex = /^[a-zA-Z0-9]{2,5}$/;
        return regex.test(tagLine);
    }

    static validateDiscordId(id) {
        // Discord IDs are 17-19 digit numbers
        const regex = /^\d{17,19}$/;
        return regex.test(id);
    }

    static validateRP(amount) {
        // RP must be a positive integer
        return Number.isInteger(amount) && amount > 0 && amount <= 999999;
    }

    static validateFriendsCount(count) {
        // Friends count must be between 0 and 250
        return Number.isInteger(count) && count >= 0 && count <= 250;
    }

    static validateAccountNickname(nickname) {
        // Account nickname validation
        return typeof nickname === 'string' && 
               nickname.length >= 3 && 
               nickname.length <= 50 &&
               !/[<>@#&]/.test(nickname); // No special Discord characters
    }

    static validateSkinName(name) {
        // Skin name validation
        return typeof name === 'string' && 
               name.length >= 3 && 
               name.length <= 100;
    }

    static validateSearchQuery(query) {
        // Search query validation
        return typeof query === 'string' && 
               query.trim().length >= 2 && 
               query.length <= 100;
    }

    static validatePrice(price) {
        // Price validation (in euros)
        return typeof price === 'number' && 
               price >= 0 && 
               price <= 10000 && 
               Number.isFinite(price);
    }

    static validateChannelId(id) {
        // Channel ID validation (same as Discord ID)
        return this.validateDiscordId(id);
    }

    static validateRoleId(id) {
        // Role ID validation (same as Discord ID)
        return this.validateDiscordId(id);
    }

    static sanitizeString(str) {
        // Remove potentially dangerous characters
        if (typeof str !== 'string') return '';
        return str.replace(/[<>@#&]/g, '').trim();
    }

    static parseRiotTag(fullTag) {
        // Parse "Username#TAG" into components
        if (!this.validateRiotTag(fullTag)) {
            return null;
        }

        const [username, tagLine] = fullTag.split('#');
        return {
            username: username.trim(),
            tagLine: tagLine.trim()
        };
    }

    static formatRiotTag(username, tagLine) {
        // Format username and tag into "Username#TAG"
        return `${username}#${tagLine}`;
    }

    static validateEmail(email) {
        // Basic email validation
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    static validateUrl(url) {
        // Basic URL validation
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static validateCryptoAddress(address, type) {
        // Basic crypto address validation
        const patterns = {
            BTC: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
            ETH: /^0x[a-fA-F0-9]{40}$/,
            LTC: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/
        };

        if (type && patterns[type]) {
            return patterns[type].test(address);
        }

        // If no specific type, check if it matches any pattern
        return Object.values(patterns).some(pattern => pattern.test(address));
    }
}

module.exports = Validators;