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

async function handleRegionStats(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        // Obter estatísticas de região
        const regionStats = await Account.getRegionStatistics();

        if (regionStats.length === 0) {
            return await interaction.editReply({
                content: 'ℹ️ Não há dados de região disponíveis.',
                ephemeral: true
            });
        }

        // Criar embed
        const embed = new EmbedBuilder()
            .setTitle('🌎 Estatísticas por Região')
            .setColor('#5865f2')
            .setTimestamp();

        // Adicionar campos para cada região
        regionStats.forEach(stat => {
            embed.addFields({
                name: `🌐 ${stat.region}`,
                value:
                    `**Contas:** ${stat.totalAccounts}\n` +
                    `**Amigos totais:** ${stat.totalFriends}\n` +
                    `**Média de amigos:** ${stat.avgFriends}\n` +
                    `**RP total:** ${stat.totalRP.toLocaleString()}`,
                inline: true
            });
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error handling region stats:', error);
        await interaction.reply({
            content: '❌ Erro ao obter estatísticas de região.',
            ephemeral: true
        });
    }
}

async function handleAccountRegion(interaction) {
    try {
        const accountId = interaction.options.getInteger('id');
        const region = interaction.options.getString('region');

        // Buscar conta
        const account = await Account.findById(accountId);

        if (!account) {
            return await interaction.reply({
                content: '❌ Conta não encontrada.',
                ephemeral: true
            });
        }

        // Obter região anterior
        const oldRegion = account.region || 'Não definida';

        // Atualizar região
        const success = await Account.updateRegion(accountId, region);

        if (!success) {
            return await interaction.reply({
                content: '❌ Erro ao atualizar região da conta.',
                ephemeral: true
            });
        }

        // Criar embed de sucesso
        const embed = new EmbedBuilder()
            .setTitle('✅ Região Atualizada')
            .setDescription(`**A região da conta foi atualizada com sucesso!**`)
            .addFields([
                { name: '🎮 Conta', value: account.nickname, inline: true },
                { name: '🌎 Região Anterior', value: oldRegion, inline: true },
                { name: '🌎 Nova Região', value: region, inline: true },
                { name: '💎 RP da Conta', value: account.rp_amount.toLocaleString(), inline: true },
                { name: '👥 Amigos', value: `${account.friends_count}/${account.max_friends}`, inline: true },
                { name: '📝 Observação', value: 'Usuários poderão adicionar esta conta somente via filtro de região correto.', inline: false }
            ])
            .setColor('#57f287')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error handling account region:', error);
        await interaction.reply({
            content: '❌ Erro ao gerenciar região da conta.',
            ephemeral: true
        });
    }
}

async function handleAddAccount(interaction) {
    try {
        const nickname = interaction.options.getString('nickname');
        const rp = interaction.options.getInteger('rp');
        const friends = interaction.options.getInteger('friends');
        const region = interaction.options.getString('region');
        const maxFriends = interaction.options.getInteger('max_friends') || 250;

        // Validar dados
        if (!nickname || nickname.length < 3 || nickname.length > 50) {
            return await interaction.reply({
                content: '❌ Nickname inválido. Deve ter entre 3 e 50 caracteres.',
                ephemeral: true
            });
        }

        if (rp < 0) {
            return await interaction.reply({
                content: '❌ Quantidade de RP inválida. Deve ser maior ou igual a 0.',
                ephemeral: true
            });
        }

        if (friends < 0 || friends > maxFriends) {
            return await interaction.reply({
                content: `❌ Quantidade de amigos inválida. Deve ser entre 0 e ${maxFriends}.`,
                ephemeral: true
            });
        }

        // Criar conta
        const accountId = await Account.create(nickname, rp, friends, maxFriends, region);
        
        // Responder
        const embed = new EmbedBuilder()
            .setTitle('✅ Conta Adicionada')
            .setDescription(`**Conta adicionada com sucesso!**\n\n` +
                          `**ID:** ${accountId}\n` +
                          `**Nickname:** ${nickname}\n` +
                          `**Região:** ${region}\n` +
                          `**RP:** ${rp.toLocaleString()}\n` +
                          `**Amigos:** ${friends}/${maxFriends}`)
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