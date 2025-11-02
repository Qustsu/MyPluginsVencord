(function() {
    // Регистрация настроек
    if (window.VencordRemotePluginAPI) {
        window.VencordRemotePluginAPI.registerPlugin({
            name: "HelperGosHIGH",
            settings: {
                sourceChannelId: {
                    type: "string",
                    label: "ID канала с вебхуками",
                    description: "Канал где приходят отчёты на повышение",
                    default: "1317168942183350312"
                },
                targetChannelId: {
                    type: "string",
                    label: "ID канала для команды",
                    description: "Канал куда отправляется команда",
                    default: "1317168933400350748"
                }
            }
        });
    }
    
    const { addContextMenuPatch } = Vencord.Api.ContextMenu;
    const { findByPropsLazy } = Vencord.Webpack;
    const { ComponentDispatch, Menu } = Vencord.Webpack.Common;
    
    const ChannelActions = findByPropsLazy("selectChannel");
    
    function getSetting(key, defaultValue) {
        if (window.VencordRemotePluginAPI) {
            return window.VencordRemotePluginAPI.getSetting("HelperGosHIGH", key, defaultValue);
        }
        return defaultValue;
    }
    
    addContextMenuPatch("message", (children, { message, channel }) => {
        const sourceChannelId = getSetting("sourceChannelId", "1317168942183350312");
        if (!message?.embeds?.[0] || channel.id !== sourceChannelId) return;
        
        const embed = message.embeds[0];
        
        children.push(
            Vencord.Webpack.Common.React.createElement(Menu.MenuItem, {
                id: "vc-webhook-to-command",
                label: "Заполнить аудит",
                action: () => {
                    try {
                        const fields = embed.fields || [];
                        
                        let rank = "";
                        let userId = "";
                        
                        for (const field of fields) {
                            if (field.rawName?.includes("На какой ранг")) {
                                rank = field.rawValue;
                            }
                            if (field.rawName?.includes("Discord")) {
                                const match = field.rawValue.match(/(\d{17,19})/);
                                if (match) userId = match[1];
                            }
                        }
                        
                        if (!rank || !userId) {
                            console.error("Не удалось найти ранг или ID пользователя");
                            return;
                        }
                        
                        const prevRank = parseInt(rank) - 1;
                        const messageUrl = `https://discord.com/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`;
                        
                        const targetChannelId = getSetting("targetChannelId", "1317168933400350748");
                        const command = `/повышение пользователь:<@${userId}> был:${prevRank} стал:${rank} причина:${messageUrl}`;
                        
                        ChannelActions.selectChannel({ channelId: targetChannelId, guildId: channel.guild_id });
                        setTimeout(() => {
                            ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: "" });
                            ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: command });
                        }, 150);
                    } catch (err) {
                        console.error("Ошибка при обработке:", err);
                    }
                }
            })
        );
    });
    
    console.log("[HelperGosHIGH] Плагин загружен");
})();
