const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.json');
const Friendship = require('../../models/Friendship');
const User = require('../../models/User');
const Account = require('../../models/Account');
const db = require('../../database/connection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('friendship-admin')
        .setDescription('Comandos administrativos para amizades (TESTES)')
        .setDefaultMemberPermissions(0),

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
            case 'set-date':
                await handleSetDate(interaction);
                break;
            case 'list-user':
                await handleListUser(interaction);
                break;
            case 'reset-notifications':
                await handleResetNotifications(interaction);
                break;
            case 'force-notification':
                await handleForceNotification(interaction);
                break;
        }
    }
};

async function handleSetDate(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const friendshipId = interaction.options.getInteger('friendship_id');
        const daysAgo = interaction.options.getInteger('days_ago');

        // Verificar se a amizade existe
        const friendship = await Friendship.findById(friendshipId);
        if (!friendship) {
            return await interaction.editReply({
                content: `❌ Amizade com ID ${friendshipId} não encontrada.`
            });
        }

        // Calcular nova data
        const newDate = new Date();
        newDate.setDate(newDate.getDate() - daysAgo);
        const newDateString = newDate.toISOString().slice(0, 19).replace('T', ' ');

        // Atualizar no banco
        const result = await db.run(
            'UPDATE friendships SET added_at = ?, notified_7_days = NULL WHERE id = ?',
            [newDateString, friendshipId]
        );

        if (result.changes === 0) {
            return await interaction.editReply({
                content: `❌ Erro ao atualizar amizade ${friendshipId}.`
            });
        }

        // Buscar informações para o embed
        const user = await User.findById(friendship.user_id);
        const account = await Account.findById(friendship.account_id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Data da Amizade Alterada')
            .setDescription(`A data da amizade foi alterada com sucesso!`)
            .addFields([
                { name: '🆔 ID da Amizade', value: friendshipId.toString(), inline: true },
                { name: '👤 Usuário', value: `${user?.username || 'Desconhecido'}`, inline: true },
                { name: '🎮 Conta', value: `${account?.nickname || 'Desconhecida'}`, inline: true },
                { name: '🏷️ Nick LoL', value: `${friendship.lol_nickname}#${friendship.lol_tag}`, inline: true },
                { name: '📅 Data Original', value: new Date(friendship.added_at).toLocaleDateString('pt-BR'), inline: true },
                { name: '📅 Nova Data', value: newDate.toLocaleDateString('pt-BR'), inline: true },
                { name: '⏰ Dias Atrás', value: `${daysAgo} dias`, inline: true },
                { name: '🔔 Notificação', value: 'Resetada (será enviada se elegível)', inline: true },
                { name: '👨‍💼 Admin', value: `${interaction.user}`, inline: true }
            ])
            .setColor('#57f287')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error setting friendship date:', error);
        await interaction.editReply({
            content: '❌ Erro ao alterar data da amizade.'
        });
    }
}

async function handleListUser(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('usuario');
        const user = await User.findByDiscordId(targetUser.id);

        if (!user) {
            return await interaction.editReply({
                content: `❌ Usuário ${targetUser.username} não encontrado no sistema.`
            });
        }

        // Buscar amizades do usuário com informações detalhadas
        const friendships = await db.all(`
            SELECT 
                f.*,
                a.nickname as account_nickname,
                a.rp_amount,
                julianday('now') - julianday(f.added_at) as days_since_added,
                CASE 
                    WHEN f.notified_7_days IS NOT NULL THEN 'Sim'
                    ELSE 'Não'
                END as notified_status
            FROM friendships f
            JOIN accounts a ON f.account_id = a.id
            WHERE f.user_id = ?
            ORDER BY f.added_at DESC
        `, [user.id]);

        if (friendships.length === 0) {
            return await interaction.editReply({
                content: `❌ ${targetUser.username} não possui amizades registradas.`
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`👥 Amizades de ${targetUser.username}`)
            .setDescription(`Total: ${friendships.length} amizades`)
            .setColor('#5865f2')
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp();

        const minDays = config.orderSettings?.minFriendshipDays || 7;

        const friendshipsList = friendships.map((friendship, index) => {
            const daysSince = Math.floor(friendship.days_since_added);
            const isEligible = daysSince >= minDays;
            const eligibleIcon = isEligible ? '✅' : '⏳';
            const notifiedIcon = friendship.notified_status === 'Sim' ? '🔔' : '🔕';
            
            return `**${index + 1}. [ID: ${friendship.id}]** ${friendship.account_nickname}\n` +
                   `   🏷️ ${friendship.lol_nickname}#${friendship.lol_tag}\n` +
                   `   📅 ${daysSince} dias (${new Date(friendship.added_at).toLocaleDateString('pt-BR')})\n` +
                   `   ${eligibleIcon} ${isEligible ? 'Elegível' : `Faltam ${minDays - daysSince} dias`}\n` +
                   `   ${notifiedIcon} ${friendship.notified_status === 'Sim' ? 'Notificado' : 'Não notificado'}\n`;
        }).join('\n');

        // Dividir em chunks se muito longo
        if (friendshipsList.length > 4096) {
            const chunks = friendshipsList.match(/[\s\S]{1,4000}/g) || [];
            embed.setDescription(`Total: ${friendships.length} amizades\n\n${chunks[0]}`);
            await interaction.editReply({ embeds: [embed] });

            for (let i = 1; i < chunks.length; i++) {
                const followEmbed = new EmbedBuilder()
                    .setDescription(chunks[i])
                    .setColor('#5865f2');
                await interaction.followUp({ embeds: [followEmbed], ephemeral: true });
            }
        } else {
            embed.setDescription(`Total: ${friendships.length} amizades\n\n${friendshipsList}`);
            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error listing user friendships:', error);
        await interaction.editReply({
            content: '❌ Erro ao listar amizades do usuário.'
        });
    }
}

async function handleResetNotifications(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('usuario');
        const user = await User.findByDiscordId(targetUser.id);

        if (!user) {
            return await interaction.editReply({
                content: `❌ Usuário ${targetUser.username} não encontrado no sistema.`
            });
        }

        // Resetar notificações do usuário
        const result = await db.run(
            'UPDATE friendships SET notified_7_days = NULL WHERE user_id = ?',
            [user.id]
        );

        const embed = new EmbedBuilder()
            .setTitle('✅ Notificações Resetadas')
            .setDescription(`Notificações de amizade resetadas para ${targetUser.username}`)
            .addFields([
                { name: '👤 Usuário', value: `${targetUser} (${targetUser.username})`, inline: true },
                { name: '🔔 Amizades Resetadas', value: result.changes.toString(), inline: true },
                { name: '👨‍💼 Admin', value: `${interaction.user}`, inline: true },
                { name: '📝 Resultado', value: 'Todas as amizades deste usuário poderão receber notificações novamente quando elegíveis.', inline: false }
            ])
            .setColor('#57f287')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error resetting notifications:', error);
        await interaction.editReply({
            content: '❌ Erro ao resetar notificações.'
        });
    }
}

async function handleForceNotification(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const friendshipId = interaction.options.getInteger('friendship_id');

        // Verificar se a amizade existe
        const friendship = await Friendship.findById(friendshipId);
        if (!friendship) {
            return await interaction.editReply({
                content: `❌ Amizade com ID ${friendshipId} não encontrada.`
            });
        }

        // Forçar notificação usando o serviço
        const FriendshipNotificationService = require('../../services/FriendshipNotificationService');
        
        // Resetar notificação primeiro
        await db.run('UPDATE friendships SET notified_7_days = NULL WHERE id = ?', [friendshipId]);

        // Buscar o bot client
        let success = false;
        let errorMsg = '';

        try {
            // Tentar acessar o serviço global
            const client = interaction.client;
            if (client && global.friendshipNotificationService) {
                success = await global.friendshipNotificationService.checkSpecificFriendship(friendshipId);
            } else {
                // Criar instância temporária se necessário
                const tempService = new FriendshipNotificationService(client);
                success = await tempService.checkSpecificFriendship(friendshipId);
            }
        } catch (notificationError) {
            errorMsg = notificationError.message;
            console.error('Error sending forced notification:', notificationError);
        }

        // Buscar informações para o embed
        const user = await User.findById(friendship.user_id);
        const account = await Account.findById(friendship.account_id);
        const currentDays = Math.floor(
            (new Date() - new Date(friendship.added_at)) / (1000 * 60 * 60 * 24)
        );

        const embed = new EmbedBuilder()
            .setTitle(success ? '✅ Notificação Enviada' : '❌ Falha na Notificação')
            .setDescription(success ? 
                'Notificação forçada enviada com sucesso!' : 
                'Falha ao enviar notificação forçada.')
            .addFields([
                { name: '🆔 ID da Amizade', value: friendshipId.toString(), inline: true },
                { name: '👤 Usuário', value: `${user?.username || 'Desconhecido'}`, inline: true },
                { name: '🎮 Conta', value: `${account?.nickname || 'Desconhecida'}`, inline: true },
                { name: '🏷️ Nick LoL', value: `${friendship.lol_nickname}#${friendship.lol_tag}`, inline: true },
                { name: '📅 Idade da Amizade', value: `${currentDays} dias`, inline: true },
                { name: '📤 Status', value: success ? '✅ Enviada' : '❌ Falhou', inline: true }
            ])
            .setColor(success ? '#57f287' : '#ed4245')
            .setTimestamp();

        if (!success && errorMsg) {
            embed.addFields([
                { name: '🐛 Erro', value: errorMsg, inline: false }
            ]);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error forcing notification:', error);
        await interaction.editReply({
            content: '❌ Erro ao forçar notificação.'
        });
    }
}