-- Скрипт кладётся в ServerScriptService приватного/основного сервера MM2.
-- Он раз в N секунд опрашивает твой backend на наличие подтверждённых заказов
-- и выдаёт игроку предмет по нику, если тот сейчас в игре.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local BACKEND_URL = "https://your-backend-domain.com/api"
local POLL_INTERVAL = 10 -- секунд

-- Таблица соответствия названия товара -> ID предмета/инструмента в твоей игре
local ITEM_TOOLS = {
	["Godly Chroma Lightbringer"] = "ReplicatedStorage.Tools.ChromaLightbringer",
	["Godly Vampire"] = "ReplicatedStorage.Tools.Vampire",
	["Chroma Bat"] = "ReplicatedStorage.Tools.ChromaBat",
	["Huge Cat Pet"] = "ReplicatedStorage.Pets.HugeCat",
}

local function giveItemToPlayer(player, itemName)
	local path = ITEM_TOOLS[itemName]
	if not path then
		warn("Нет соответствия для предмета: " .. itemName)
		return false
	end

	-- пример: клонируем инструмент из ReplicatedStorage в StarterPack/Backpack игрока
	local success, err = pcall(function()
		local tool = game:GetService("ReplicatedStorage").Tools:FindFirstChild(itemName)
		if tool then
			local clone = tool:Clone()
			clone.Parent = player.Backpack
		end
	end)

	return success
end

local function checkDeliveries()
	local ok, response = pcall(function()
		return HttpService:GetAsync(BACKEND_URL .. "/pending-deliveries")
	end)
	if not ok then
		warn("Не удалось получить список заказов: " .. tostring(response))
		return
	end

	local orders = HttpService:JSONDecode(response)

	for _, order in ipairs(orders) do
		local targetPlayer = nil
		for _, player in ipairs(Players:GetPlayers()) do
			if player.Name:lower() == order.roblox_nickname:lower() then
				targetPlayer = player
				break
			end
		end

		if targetPlayer then
			local allDelivered = true
			for _, item in ipairs(order.items) do
				for i = 1, item.qty do
					local delivered = giveItemToPlayer(targetPlayer, item.name)
					if not delivered then allDelivered = false end
				end
			end

			if allDelivered then
				pcall(function()
					HttpService:PostAsync(
						BACKEND_URL .. "/mark-delivered/" .. order.order_id,
						"{}",
						Enum.HttpContentType.ApplicationJson
					)
				end)
				targetPlayer:Kick("Спасибо за покупку! Предметы выданы 🎉")
			end
		end
		-- если игрока нет на сервере - заказ останется approved,
		-- скрипт попробует снова на следующем цикле опроса
	end
end

while true do
	checkDeliveries()
	task.wait(POLL_INTERVAL)
end
