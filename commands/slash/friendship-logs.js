const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.json');
const FriendshipLog = require('../../models/FriendshipLog');
const Friendship = require('../../models/Friendship');
const Account = require('../../models/Account');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('friendship-logs')
        .setDescription('Mostra logs e estatísticas de amizades')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Estatísticas gerais de amizades')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('recent')
                .setDescription('Amizades recentes')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Número de amizades a mostrar (padrão: 10)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Amizades de um usuário específico')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para verificar')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pending')
                .setDescription('Pedidos de amizade pendentes')
        ),

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
            case 'stats':
                await handleFriendshipStats(interaction);
                break;
            case 'recent':
                await handleRecentFriendships(interaction);
                break;
            case 'user':
                await handleUserFriendships(interaction);
                break;
            case 'pending':
                await handlePendingFriendships(interaction);
                break;
        }
    }
};

async function handleFriendshipStats(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const logStats = await FriendshipLog.getStatistics();
        const friendshipStats = await Friendship.getStatistics();
        const accountStats = await Account.getTopAccounts(5);

        const embed = new EmbedBuilder()
            .setTitle('📊 Estatísticas de Amizades')
            .setColor('#5865f2')
            .addFields([
                {
                    name: '📋 Solicitações',
                    value: 
                        `**Total:** ${logStats.totalRequests}\n` +
                        `**Pendentes:** ${logStats.pendingRequests}\n` +
                        `**Aprovadas:** ${logStats.approvedRequests}\n` +
                        `**Rejeitadas:** ${logStats.rejectedRequests}`,
                    inline: true
                },
                {
                    name: '👥 Amizades Ativas',
                    value: 
                        `**Total:** ${friendshipStats.totalFriendships}\n` +
                        `**Usuários únicos:** ${friendshipStats.usersWithFriends}\n` +
                        `**Contas utilizadas:** ${friendshipStats.accountsWithFriends}\n` +
                        `**Média por usuário:** ${friendshipStats.averageFriendsPerUser.toFixed(1)}`,
                    inline: true
                },
                {
                    name: '🏆 Top Contas (por amigos)',
                    value: accountStats.map(acc => 
                        `**${acc.nickname}:** ${acc.friend_count}/${acc.max_friends} (${acc.fill_percentage}%)`
                    ).join('\n') || 'Nenhuma conta encontrada',
                    inline: false
                }
            ])
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting friendship stats:', error);
        await interaction.editReply({ content: '❌ Erro ao obter estatísticas.' });
    }
}

async function handleRecentFriendships(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const limit = interaction.options.getInteger('limit') || 10;
        const recentFriendships = await Friendship.getRecentFriendships(limit);

        if (recentFriendships.length === 0) {
            return await interaction.editReply({ content: 'ℹ️ Nenhuma amizade encontrada.' });
        }

        const embed = new EmbedBuilder()
            .setTitle(`👥 ${limit} Amizades Mais Recentes`)
            .setColor('#5865f2')
            .setTimestamp();

        const friendshipList = recentFriendships.map((friendship, index) => {
            const timeAgo = getTimeAgo(friendship.added_at);
            return `**${index + 1}.** ${friendship.username} → ${friendship.account_nickname}\n` +
                   `   🏷️ Nick LoL: ${friendship.lol_nickname}#${friendship.lol_tag}\n` +
                   `   ⏰ ${timeAgo} atrás\n`;
        }).join('\n');

        embed.setDescription(friendshipList);

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting recent friendships:', error);
        await interaction.editReply({ content: '❌ Erro ao obter amizades recentes.' });
    }
}

async function handleUserFriendships(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('usuario');
        const user = await User.findByDiscordId(targetUser.id);

        if (!user) {
            return await interaction.editReply({ 
                content: '❌ Usuário não encontrado no sistema.' 
            });
        }

        const friendships = await Friendship.getUsersFriendships(user.id);

        if (friendships.length === 0) {
            return await interaction.editReply({ 
                content: `ℹ️ ${targetUser.username} não possui amizades registradas.` 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`👥 Amizades de ${targetUser.username}`)
            .setColor('#5865f2')
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp();

        const friendshipsList = friendships.map((friendship, index) => {
            const timeAgo = getTimeAgo(friendship.added_at);
            const rpAvailable = friendship.rp_amount ? `${friendship.rp_amount.toLocaleString()} RP` : 'N/A';
            const friendsCount = friendship.friends_count || 0;
            const maxFriends = friendship.max_friends || 250;
            
            return `**${index + 1}.** ${friendship.account_nickname}\n` +
                   `   🏷️ Nick LoL: ${friendship.lol_nickname}#${friendship.lol_tag}\n` +
                   `   💎 RP: ${rpAvailable}\n` +
                   `   👥 Amigos: ${friendsCount}/${maxFriends}\n` +
                   `   ⏰ Adicionado ${timeAgo} atrás\n`;
        }).join('\n');

        embed.setDescription(friendshipsList);

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting user friendships:', error);
        await interaction.editReply({ content: '❌ Erro ao obter amizades do usuário.' });
    }
}

async function handlePendingFriendships(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const pendingRequests = await FriendshipLog.findPendingRequests(15);

        if (pendingRequests.length === 0) {
            return await interaction.editReply({ 
                content: 'ℹ️ Nenhum pedido de amizade pendente.' 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`⏳ Pedidos de Amizade Pendentes (${pendingRequests.length})`)
            .setColor('#faa61a')
            .setTimestamp();

        const pendingList = pendingRequests.map((request, index) => {
            const timeAgo = getTimeAgo(request.created_at);
            return `**${index + 1}.** ${request.username || 'Usuário desconhecido'}\n` +
                   `   🎮 Para: ${request.account_nickname || 'Conta desconhecida'}\n` +
                   `   🏷️ Nick LoL: ${request.lol_nickname}#${request.lol_tag}\n` +
                   `   ⏰ Enviado ${timeAgo} atrás\n` +
                   `   🆔 ID: ${request.id}\n`;
        }).join('\n');

        embed.setDescription(pendingList);
        embed.setFooter({ text: 'Use os botões nos canais de aprovação para processar' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting pending friendships:', error);
        await interaction.editReply({ content: '❌ Erro ao obter pedidos pendentes.' });
    }
}

function getTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffInMs = now - past;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) return 'agora';
    if (diffInMinutes < 60) return `${diffInMinutes} minuto(s)`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hora(s)`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} dia(s)`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} mês(es)`;
    
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} ano(s)`;
}