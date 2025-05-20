const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.json');
const db = require('../../database/connection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revenue')
        .setDescription('Mostra estatísticas de faturamento da loja')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('summary')
                .setDescription('Resumo geral do faturamento')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('detailed')
                .setDescription('Faturamento detalhado por período')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('top-clients')
                .setDescription('Top clientes por faturamento')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Número de clientes a mostrar (padrão: 10)')
                        .setRequired(false)
                )
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
            case 'summary':
                await handleRevenueSummary(interaction);
                break;
            case 'detailed':
                await handleDetailedRevenue(interaction);
                break;
            case 'top-clients':
                await handleTopClients(interaction);
                break;
        }
    }
};

async function handleRevenueSummary(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        // Faturamento total
        const totalRevenue = await db.get(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_price) as total_revenue,
                SUM(total_rp) as total_rp
            FROM order_logs 
            WHERE status = 'COMPLETED'
        `);

        // Faturamento hoje
        const todayRevenue = await db.get(`
            SELECT 
                COUNT(*) as orders,
                SUM(total_price) as revenue,
                SUM(total_rp) as rp
            FROM order_logs 
            WHERE status = 'COMPLETED' 
            AND date(created_at) = date('now')
        `);

        // Faturamento na última semana
        const weekRevenue = await db.get(`
            SELECT 
                COUNT(*) as orders,
                SUM(total_price) as revenue,
                SUM(total_rp) as rp
            FROM order_logs 
            WHERE status = 'COMPLETED' 
            AND created_at >= datetime('now', '-7 days')
        `);

        // Faturamento no último mês
        const monthRevenue = await db.get(`
            SELECT 
                COUNT(*) as orders,
                SUM(total_price) as revenue,
                SUM(total_rp) as rp
            FROM order_logs 
            WHERE status = 'COMPLETED' 
            AND created_at >= datetime('now', '-30 days')
        `);

        // Ticket médio
        const avgTicket = totalRevenue.total_orders > 0 ? 
            (totalRevenue.total_revenue / totalRevenue.total_orders) : 0;

        // Pedidos pendentes
        const pendingOrders = await db.get(`
            SELECT COUNT(*) as count
            FROM order_logs 
            WHERE status IN ('PENDING_PAYMENT_PROOF', 'PENDING_MANUAL_APPROVAL', 'AWAITING_ACCOUNT_SELECTION')
        `);

        // Crescimento semanal
        const lastWeekRevenue = await db.get(`
            SELECT SUM(total_price) as revenue
            FROM order_logs 
            WHERE status = 'COMPLETED' 
            AND created_at >= datetime('now', '-14 days')
            AND created_at < datetime('now', '-7 days')
        `);

        const weekGrowth = lastWeekRevenue && lastWeekRevenue.revenue > 0 ? 
            ((weekRevenue.revenue - lastWeekRevenue.revenue) / lastWeekRevenue.revenue * 100) : 0;

        const embed = new EmbedBuilder()
            .setTitle('💰 Resumo do Faturamento')
            .setColor('#57f287')
            .addFields([
                {
                    name: '📊 Total Geral',
                    value: 
                        `**Pedidos:** ${totalRevenue.total_orders || 0}\n` +
                        `**Faturamento:** €${(totalRevenue.total_revenue || 0).toFixed(2)}\n` +
                        `**RP Vendido:** ${(totalRevenue.total_rp || 0).toLocaleString()}\n` +
                        `**Ticket Médio:** €${avgTicket.toFixed(2)}`,
                    inline: true
                },
                {
                    name: '📅 Hoje',
                    value: 
                        `**Pedidos:** ${todayRevenue.orders || 0}\n` +
                        `**Faturamento:** €${(todayRevenue.revenue || 0).toFixed(2)}\n` +
                        `**RP Vendido:** ${(todayRevenue.rp || 0).toLocaleString()}`,
                    inline: true
                },
                {
                    name: '📆 Última Semana',
                    value: 
                        `**Pedidos:** ${weekRevenue.orders || 0}\n` +
                        `**Faturamento:** €${(weekRevenue.revenue || 0).toFixed(2)}\n` +
                        `**RP Vendido:** ${(weekRevenue.rp || 0).toLocaleString()}\n` +
                        `**Crescimento:** ${weekGrowth > 0 ? '+' : ''}${weekGrowth.toFixed(1)}%`,
                    inline: true
                },
                {
                    name: '🗓️ Último Mês',
                    value: 
                        `**Pedidos:** ${monthRevenue.orders || 0}\n` +
                        `**Faturamento:** €${(monthRevenue.revenue || 0).toFixed(2)}\n` +
                        `**RP Vendido:** ${(monthRevenue.rp || 0).toLocaleString()}`,
                    inline: true
                },
                {
                    name: '⏳ Status Atual',
                    value: 
                        `**Pedidos pendentes:** ${pendingOrders.count || 0}\n` +
                        `**Sistema:** 🟢 Operacional\n` +
                        `**Último update:** <t:${Math.floor(Date.now() / 1000)}:R>`,
                    inline: true
                },
                {
                    name: '📈 Performance',
                    value: 
                        `**Taxa de conversão:** ${totalRevenue.total_orders > 0 ? ((totalRevenue.total_orders / (totalRevenue.total_orders + (pendingOrders.count || 0))) * 100).toFixed(1) : 0}%\n` +
                        `**Maior pedido:** €${totalRevenue.total_revenue > 0 ? (totalRevenue.total_revenue / Math.max(totalRevenue.total_orders, 1)).toFixed(2) : '0.00'}\n` +
                        `**RP por €:** ${totalRevenue.total_revenue > 0 ? Math.round(totalRevenue.total_rp / totalRevenue.total_revenue) : 0}`,
                    inline: true
                }
            ])
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'Sistema PawStore - Relatório Financeiro' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting revenue summary:', error);
        await interaction.editReply({ content: '❌ Erro ao obter resumo financeiro.' });
    }
}

async function handleDetailedRevenue(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        // Faturamento por dia (últimos 7 dias)
        const dailyRevenue = await db.all(`
            SELECT 
                date(created_at) as day,
                COUNT(*) as orders,
                SUM(total_price) as revenue,
                SUM(total_rp) as rp,
                AVG(total_price) as avg_ticket
            FROM order_logs 
            WHERE status = 'COMPLETED' 
            AND created_at >= datetime('now', '-7 days')
            GROUP BY date(created_at)
            ORDER BY day DESC
        `);

        // Faturamento por semana (últimas 4 semanas)
        const weeklyRevenue = await db.all(`
            SELECT 
                strftime('%Y-W%W', created_at) as week,
                COUNT(*) as orders,
                SUM(total_price) as revenue,
                SUM(total_rp) as rp,
                AVG(total_price) as avg_ticket
            FROM order_logs 
            WHERE status = 'COMPLETED' 
            AND created_at >= datetime('now', '-28 days')
            GROUP BY strftime('%Y-W%W', created_at)
            ORDER BY week DESC
        `);

        // Faturamento por mês (últimos 6 meses)
        const monthlyRevenue = await db.all(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                COUNT(*) as orders,
                SUM(total_price) as revenue,
                SUM(total_rp) as rp,
                AVG(total_price) as avg_ticket
            FROM order_logs 
            WHERE status = 'COMPLETED' 
            AND created_at >= datetime('now', '-6 months')
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY month DESC
        `);

        // Horários de pico
        const hourlyRevenue = await db.all(`
            SELECT 
                strftime('%H', created_at) as hour,
                COUNT(*) as orders,
                SUM(total_price) as revenue
            FROM order_logs 
            WHERE status = 'COMPLETED' 
            AND created_at >= datetime('now', '-7 days')
            GROUP BY strftime('%H', created_at)
            ORDER BY orders DESC
            LIMIT 3
        `);

        const embed = new EmbedBuilder()
            .setTitle('📈 Faturamento Detalhado')
            .setColor('#5865f2')
            .setTimestamp();

        // Últimos 7 dias
        if (dailyRevenue.length > 0) {
            const dailyText = dailyRevenue.map(day => {
                const date = new Date(day.day + 'T00:00:00Z');
                const formattedDate = date.toLocaleDateString('pt-BR', { 
                    weekday: 'short', 
                    day: '2-digit', 
                    month: '2-digit' 
                });
                return `**${formattedDate}:** ${day.orders} pedidos - €${day.revenue.toFixed(2)} (avg: €${day.avg_ticket.toFixed(2)})`;
            }).join('\n');

            embed.addFields([{
                name: '📅 Últimos 7 Dias',
                value: dailyText.length > 1024 ? dailyText.substring(0, 1021) + '...' : dailyText,
                inline: false
            }]);
        }

        // Últimas 4 semanas
        if (weeklyRevenue.length > 0) {
            const weeklyText = weeklyRevenue.map((week, index) => {
                const weekNum = week.week.split('-W')[1];
                return `**Semana ${weekNum}:** ${week.orders} pedidos - €${week.revenue.toFixed(2)} (avg: €${week.avg_ticket.toFixed(2)})`;
            }).join('\n');

            embed.addFields([{
                name: '📆 Últimas 4 Semanas',
                value: weeklyText.length > 1024 ? weeklyText.substring(0, 1021) + '...' : weeklyText,
                inline: false
            }]);
        }

        // Últimos 6 meses
        if (monthlyRevenue.length > 0) {
            const monthlyText = monthlyRevenue.map(month => {
                const [year, monthNum] = month.month.split('-');
                const monthName = new Date(year, monthNum - 1).toLocaleDateString('pt-BR', { 
                    month: 'long', year: 'numeric' 
                });
                return `**${monthName}:** ${month.orders} pedidos - €${month.revenue.toFixed(2)} (avg: €${month.avg_ticket.toFixed(2)})`;
            }).join('\n');

            embed.addFields([{
                name: '🗓️ Últimos 6 Meses',
                value: monthlyText.length > 1024 ? monthlyText.substring(0, 1021) + '...' : monthlyText,
                inline: false
            }]);
        }

        // Horários de pico
        if (hourlyRevenue.length > 0) {
            const hourlyText = hourlyRevenue.map((hour, index) => {
                const icons = ['🥇', '🥈', '🥉'];
                return `${icons[index]} **${hour.hour}:00h** - ${hour.orders} pedidos (€${hour.revenue.toFixed(2)})`;
            }).join('\n');

            embed.addFields([{
                name: '🕐 Horários de Pico (últimos 7 dias)',
                value: hourlyText,
                inline: false
            }]);
        }

        if (dailyRevenue.length === 0 && weeklyRevenue.length === 0 && monthlyRevenue.length === 0) {
            embed.setDescription('ℹ️ Nenhum dado de faturamento encontrado.');
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting detailed revenue:', error);
        await interaction.editReply({ content: '❌ Erro ao obter faturamento detalhado.' });
    }
}

async function handleTopClients(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const limit = interaction.options.getInteger('limit') || 10;

        const topClients = await db.all(`
            SELECT 
                ol.user_id,
                COUNT(*) as order_count,
                SUM(ol.total_price) as total_spent,
                SUM(ol.total_rp) as total_rp,
                AVG(ol.total_price) as avg_ticket,
                MAX(ol.created_at) as last_order,
                MIN(ol.created_at) as first_order
            FROM order_logs ol
            WHERE ol.status = 'COMPLETED'
            GROUP BY ol.user_id
            ORDER BY total_spent DESC
            LIMIT ?
        `, [limit]);

        if (topClients.length === 0) {
            return await interaction.editReply({ 
                content: 'ℹ️ Nenhum cliente encontrado.' 
            });
        }

        // Estatísticas gerais
        const totalRevenue = topClients.reduce((sum, client) => sum + client.total_spent, 0);
        const totalOrders = topClients.reduce((sum, client) => sum + client.order_count, 0);

        const embed = new EmbedBuilder()
            .setTitle(`🏆 Top ${limit} Clientes por Faturamento`)
            .setDescription(
                `**Total representado:** €${totalRevenue.toFixed(2)} (${totalOrders} pedidos)\n` +
                `**Ticket médio do grupo:** €${(totalRevenue / totalOrders).toFixed(2)}\n`
            )
            .setColor('#faa61a')
            .setTimestamp();

        let clientList = '';
        for (let i = 0; i < topClients.length; i++) {
            const client = topClients[i];
            let username = 'Usuário desconhecido';
            
            try {
                const discordUser = await interaction.client.users.fetch(client.user_id);
                username = discordUser.username;
            } catch (error) {
                console.log(`Could not fetch user ${client.user_id}`);
            }

            const timeSinceLastOrder = getTimeAgo(client.last_order);
            const customerSince = getTimeAgo(client.first_order);
            const loyaltyScore = client.order_count * (client.total_spent / 100);

            // Determinar badge do cliente
            let badge = '';
            if (client.total_spent >= 100) badge = '💎 VIP';
            else if (client.total_spent >= 50) badge = '🥇 Gold';
            else if (client.total_spent >= 25) badge = '🥈 Silver';
            else badge = '🥉 Bronze';

            clientList += `**${i + 1}.** ${username} ${badge}\n` +
                         `   💰 Total: €${client.total_spent.toFixed(2)} | Ticket médio: €${client.avg_ticket.toFixed(2)}\n` +
                         `   📦 Pedidos: ${client.order_count} | 💎 RP: ${client.total_rp.toLocaleString()}\n` +
                         `   📅 Cliente há ${customerSince} | Último pedido: ${timeSinceLastOrder} atrás\n` +
                         `   ⭐ Score de lealdade: ${loyaltyScore.toFixed(1)}\n\n`;
        }

        // Dividir em múltiplos embeds se necessário
        if (clientList.length > 4096) {
            const chunks = clientList.match(/[\s\S]{1,2000}/g) || [];
            embed.setDescription(embed.data.description + '\n' + chunks[0]);
            await interaction.editReply({ embeds: [embed] });

            for (let i = 1; i < chunks.length; i++) {
                const followEmbed = new EmbedBuilder()
                    .setDescription(chunks[i])
                    .setColor('#faa61a');
                await interaction.followUp({ embeds: [followEmbed], ephemeral: true });
            }
        } else {
            embed.addFields([{
                name: '👑 Rankings',
                value: clientList,
                inline: false
            }]);
            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error getting top clients:', error);
        await interaction.editReply({ content: '❌ Erro ao obter top clientes.' });
    }
}

function getTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffInMs = now - past;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) return 'agora mesmo';
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