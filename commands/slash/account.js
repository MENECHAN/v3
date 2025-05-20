const { EmbedBuilder } = require('discord.js');
const config = require('../../config.json');
const Account = require('../../models/Account');

module.exports = {
    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await handleAddAccount(interaction);
                break;
            case 'remove':
                await handleRemoveAccount(interaction);
                break;
            case 'edit':
                await handleEditAccount(interaction);
                break;
            case 'list':
                await handleListAccounts(interaction);
                break;
        }
    }
};

async function handleAddAccount(interaction) {
    const nickname = interaction.options.getString('nickname');
    const rp = interaction.options.getInteger('rp');
    const friends = interaction.options.getInteger('friends');

    try {
        const accountId = await Account.create(nickname, rp, friends);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Conta Adicionada')
            .setDescription(`**Conta adicionada com sucesso!**\n\n` +
                          `**ID:** ${accountId}\n` +
                          `**Nickname:** ${nickname}\n` +
                          `**RP:** ${rp.toLocaleString()}\n` +
                          `**Amigos:** ${friends}/250`)
            .setColor('#57f287')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error adding account:', error);
        await interaction.reply({
            content: '❌ Erro ao adicionar conta.',
            ephemeral: true
        });
    }
}

async function handleRemoveAccount(interaction) {
    const accountId = interaction.options.getInteger('id');

    try {
        const account = await Account.findById(accountId);
        
        if (!account) {
            return await interaction.reply({
                content: '❌ Conta não encontrada.',
                ephemeral: true
            });
        }

        await Account.delete(accountId);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Conta Removida')
            .setDescription(`**Conta removida com sucesso!**\n\n` +
                          `**ID:** ${accountId}\n` +
                          `**Nickname:** ${account.nickname}`)
            .setColor('#ed4245')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error removing account:', error);
        await interaction.reply({
            content: '❌ Erro ao remover conta.',
            ephemeral: true
        });
    }
}



async function handleEditAccount(interaction) {
    const accountId = interaction.options.getInteger('id');
    const nickname = interaction.options.getString('nickname');
    const rp = interaction.options.getInteger('rp');
    const friends = interaction.options.getInteger('friends');

    try {
        const account = await Account.findById(accountId);
        
        if (!account) {
            return await interaction.reply({
                content: '❌ Conta não encontrada.',
                ephemeral: true
            });
        }

        const updates = {};
        if (nickname) updates.nickname = nickname;
        if (rp !== null) updates.rp_amount = rp;
        if (friends !== null) updates.friends_count = friends;

        await Account.update(accountId, updates);
        
        const updatedAccount = await Account.findById(accountId);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Conta Editada')
            .setDescription(`**Conta editada com sucesso!**\n\n` +
                          `**ID:** ${accountId}\n` +
                          `**Nickname:** ${updatedAccount.nickname}\n` +
                          `**RP:** ${updatedAccount.rp_amount.toLocaleString()}\n` +
                          `**Amigos:** ${updatedAccount.friends_count}/250`)
            .setColor('#faa61a')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error editing account:', error);
        await interaction.reply({
            content: '❌ Erro ao editar conta.',
            ephemeral: true
        });
    }
}

async function handleListAccounts(interaction) {
    try {
        const accounts = await Account.findAll();
        
        if (accounts.length === 0) {
            return await interaction.reply({
                content: 'ℹ️ Nenhuma conta encontrada.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Lista de Contas')
            .setColor('#5865f2')
            .setTimestamp();

        const accountList = accounts.map(account => {
            return `**ID:** ${account.id} | **Nick:** ${account.nickname}\n` +
                   `**RP:** ${account.rp_amount.toLocaleString()} | **Amigos:** ${account.friends_count}/250\n`;
        }).join('\n');

        embed.setDescription(accountList);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error listing accounts:', error);
        await interaction.reply({
            content: '❌ Erro ao listar contas.',
            ephemeral: true
        });
    }
}