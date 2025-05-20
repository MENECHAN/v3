const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.json');
const db = require('../../database/connection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revenue')
        .setDescription('Mostra estatísticas completas de faturamento da loja')
        .setDefaultMemberPermissions(0)
        .addIntegerOption(option =>
            option.setName('dias')
                .setDescription('Período para analisar (dias, padrão: 30)')
                .setRequired(false)
                .addChoices(
                    { name: 'Últimos 7 dias', value: 7 },
                    { name: 'Últimos 30 dias', value: 30 },
                    { name: 'Últimos 90 dias', value: 90 },
                    { name: 'Ano inteiro', value: 365 }
                )
        )
        .addIntegerOption(option =>
            option.setName('top_clientes')
                .setDescription('Número de top clientes a mostrar (padrão: 5)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        ),

    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Obter parâmetros
            const days = interaction.options.getInteger('dias') || 30;
            const topClientsLimit = interaction.options.getInteger('top_clientes') || 5;
            
            // Criar embed principal
            const mainEmbed = new EmbedBuilder()
                .setTitle('💰 Dashboard Financeiro')
                .setDescription(`Relatório financeiro completo da loja.\nPeríodo analisado: últimos **${days} dias**`)
                .setColor('#57f287')
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'Sistema PawStore - Relatório Financeiro' })
                .setTimestamp();

            // SEÇÃO 1: RESUMO GERAL
            // -----------------------------
            
            // Faturamento total (todos os tempos)
            const totalRevenue = await db.get(`
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(total_price) as total_revenue,
                    SUM(total_rp) as total_rp,
                    MAX(total_price) as highest_order,
                    AVG(total_price) as avg_order
                FROM order_logs 
                WHERE status = 'COMPLETED'
            `);

            // Faturamento no período especificado
            const periodRevenue = await db.get(`
                SELECT 
                    COUNT(*) as orders,
                    SUM(total_price) as revenue,
                    SUM(total_rp) as rp
                FROM order_logs 
                WHERE status = 'COMPLETED' 
                AND created_at >= datetime('now', '-${days} days')
            `);
            
            // Pedidos pendentes
            const pendingOrders = await db.get(`
                SELECT COUNT(*) as count
                FROM order_logs 
                WHERE status IN ('PENDING_PAYMENT_PROOF', 'PENDING_MANUAL_APPROVAL', 'AWAITING_ACCOUNT_SELECTION')
            `);

            // Hoje
            const todayRevenue = await db.get(`
                SELECT 
                    COUNT(*) as orders,
                    SUM(total_price) as revenue
                FROM order_logs 
                WHERE status = 'COMPLETED' 
                AND date(created_at) = date('now')
            `);

            // Calcular crescimento em relação ao período anterior igual
            const previousPeriodRevenue = await db.get(`
                SELECT SUM(total_price) as revenue
                FROM order_logs 
                WHERE status = 'COMPLETED' 
                AND created_at >= datetime('now', '-${days*2} days')
                AND created_at < datetime('now', '-${days} days')
            `);

            const growthRate = previousPeriodRevenue && previousPeriodRevenue.revenue > 0 ? 
                ((periodRevenue.revenue - previousPeriodRevenue.revenue) / previousPeriodRevenue.revenue * 100) : 0;
            
            // Adicionar campos ao embed
            mainEmbed.addFields([
                {
                    name: '📊 Resumo dos Últimos ' + days + ' Dias',
                    value: 
                        `**Pedidos:** ${periodRevenue.orders || 0}\n` +
                        `**Faturamento:** €${(periodRevenue.revenue || 0).toFixed(2)}\n` +
                        `**RP Vendido:** ${(periodRevenue.rp || 0).toLocaleString()}\n` +
                        `**Crescimento:** ${growthRate > 0 ? '📈 +' : '📉 '}${growthRate.toFixed(1)}%`,
                    inline: true
                },
                {
                    name: '💹 Estatísticas Gerais',
                    value: 
                        `**Total de Pedidos:** ${totalRevenue.total_orders || 0}\n` +
                        `**Faturamento Total:** €${(totalRevenue.total_revenue || 0).toFixed(2)}\n` +
                        `**Ticket Médio:** €${(totalRevenue.avg_order || 0).toFixed(2)}\n` +
                        `**Maior Pedido:** €${(totalRevenue.highest_order || 0).toFixed(2)}`,
                    inline: true
                },
                {
                    name: '📅 Hoje',
                    value: 
                        `**Pedidos:** ${todayRevenue.orders || 0}\n` +
                        `**Faturamento:** €${(todayRevenue.revenue || 0).toFixed(2)}\n` +
                        `**Pendentes:** ${pendingOrders.count || 0}`,
                    inline: true
                }
            ]);

            // SEÇÃO 2: DESEMPENHO DIÁRIO
            // -----------------------------
            
            // Limitar a 7 dias para não sobrecarregar o embed
            const daysToShow = Math.min(days, 7);
            
            // Faturamento por dia 
            const dailyRevenue = await db.all(`
                SELECT 
                    date(created_at) as day,
                    COUNT(*) as orders,
                    SUM(total_price) as revenue
                FROM order_logs 
                WHERE status = 'COMPLETED' 
                AND created_at >= datetime('now', '-${daysToShow} days')
                GROUP BY date(created_at)
                ORDER BY day DESC
            `);

            if (dailyRevenue && dailyRevenue.length > 0) {
                let dailyChart = '';
                
                for (const day of dailyRevenue) {
                    const date = new Date(day.day);
                    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}`;
                    const barLength = Math.round((day.revenue / (periodRevenue.revenue / daysToShow)) * 10);
                    const bar = '▓'.repeat(Math.min(barLength, 15)) || '▁';
                    
                    dailyChart += `**${formattedDate}:** ${bar} €${day.revenue.toFixed(2)} (${day.orders} pedidos)\n`;
                }
                
                mainEmbed.addFields([{
                    name: '📈 Desempenho Diário',
                    value: dailyChart || 'Sem dados para o período',
                    inline: false
                }]);
            }

            // SEÇÃO 3: TOP CLIENTES
            // -----------------------------
            
            const topClients = await db.all(`
                SELECT 
                    ol.user_id,
                    COUNT(*) as order_count,
                    SUM(ol.total_price) as total_spent,
                    MAX(ol.created_at) as last_order
                FROM order_logs ol
                WHERE ol.status = 'COMPLETED'
                AND ol.created_at >= datetime('now', '-${days} days')
                GROUP BY ol.user_id
                ORDER BY total_spent DESC
                LIMIT ?
            `, [topClientsLimit]);

            if (topClients && topClients.length > 0) {
                let clientsList = '';
                
                for (let i = 0; i < topClients.length; i++) {
                    const client = topClients[i];
                    let username = 'Usuário ID: ' + client.user_id;
                    
                    try {
                        const discordUser = await interaction.client.users.fetch(client.user_id);
                        username = discordUser.username;
                    } catch (error) {
                        console.log(`Could not fetch user ${client.user_id}`);
                    }
                    
                    const lastOrderDate = new Date(client.last_order);
                    const formattedDate = `${lastOrderDate.getDate().toString().padStart(2, '0')}/${(lastOrderDate.getMonth()+1).toString().padStart(2, '0')}`;
                    
                    // Determinar badge do cliente com base no valor gasto
                    let badge = '';
                    if (client.total_spent >= 100) badge = '💎';
                    else if (client.total_spent >= 50) badge = '🥇';
                    else if (client.total_spent >= 25) badge = '🥈';
                    else badge = '🥉';
                    
                    clientsList += `${badge} **${i+1}. ${username}** - €${client.total_spent.toFixed(2)} (${client.order_count} pedidos)\n`;
                }
                
                mainEmbed.addFields([{
                    name: '👑 Top Clientes - Últimos ' + days + ' Dias',
                    value: clientsList || 'Sem dados para o período',
                    inline: false
                }]);
            }

            // SEÇÃO 4: MÉTODOS DE PAGAMENTO E RP CONSUMIDO
            // -----------------------------
            
            // Análise de RP consumido por conta (top 3)
            const topRpAccounts = await db.all(`
                SELECT 
                    a.nickname as account_name,
                    SUM(ol.total_rp) as rp_used
                FROM order_logs ol
                JOIN accounts a ON ol.debited_from_account_id = a.id
                WHERE ol.status = 'COMPLETED'
                AND ol.created_at >= datetime('now', '-${days} days')
                GROUP BY ol.debited_from_account_id
                ORDER BY rp_used DESC
                LIMIT 3
            `);

            if (topRpAccounts && topRpAccounts.length > 0) {
                const rpList = topRpAccounts.map((acc, index) => 
                    `**${index+1}.** ${acc.account_name || 'Conta desconhecida'} - ${acc.rp_used.toLocaleString()} RP`
                ).join('\n');
                
                mainEmbed.addFields([{
                    name: '💎 Contas Mais Utilizadas',
                    value: rpList || 'Sem dados disponíveis',
                    inline: true
                }]);
            }

            // Horários de pico
            const peakHours = await db.all(`
                SELECT 
                    strftime('%H', created_at) as hour,
                    COUNT(*) as orders,
                    SUM(total_price) as revenue
                FROM order_logs 
                WHERE status = 'COMPLETED' 
                AND created_at >= datetime('now', '-${days} days')
                GROUP BY strftime('%H', created_at)
                ORDER BY orders DESC
                LIMIT 3
            `);

            if (peakHours && peakHours.length > 0) {
                const hoursList = peakHours.map((hour, index) => 
                    `**${hour.hour}h** - ${hour.orders} pedidos (€${hour.revenue.toFixed(2)})`
                ).join('\n');
                
                mainEmbed.addFields([{
                    name: '⏰ Horários de Pico',
                    value: hoursList || 'Sem dados disponíveis',
                    inline: true
                }]);
            }

            // SEÇÃO 5: PREVISÃO E STATUS DO SISTEMA
            // -----------------------------
            
            // Estimativa do próximo período
            let estimatedRevenue = 0;
            if (periodRevenue && periodRevenue.revenue) {
                // Calculando uma estimativa simples com base na taxa de crescimento
                estimatedRevenue = periodRevenue.revenue * (1 + (growthRate / 100));
            }
            
            mainEmbed.addFields([{
                name: '🔮 Previsão e Status',
                value: 
                    `**Previsão ${days} dias:** €${estimatedRevenue.toFixed(2)}\n` +
                    `**Status do Sistema:** 🟢 Operacional\n` +
                    `**Última Atualização:** <t:${Math.floor(Date.now()/1000)}:R>`,
                inline: false
            }]);

            // Enviar o embed
            await interaction.editReply({ embeds: [mainEmbed] });
            
        } catch (error) {
            console.error('Error generating revenue report:', error);
            await interaction.editReply({ 
                content: '❌ Erro ao gerar relatório de faturamento: ' + error.message
            });
        }
    }
};