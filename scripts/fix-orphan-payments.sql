-- Script para corrigir pagamentos órfãos (sem user_id)
-- Problema: Os Order Bumps estão sendo salvos com user_id NULL porque o bot não tem user_id

-- O usuário logado é: 7db32fb5-e69a-42ff-9157-f92fc30269a1
-- O bot com os Order Bumps é: 65f4a521-b310-4638-bfb3-522895406e30

-- PASSO 1: Verificar o estado atual do bot
SELECT id, name, user_id, created_at 
FROM bots 
WHERE id = '65f4a521-b310-4638-bfb3-522895406e30';

-- PASSO 2: Atualizar o bot para ter o user_id correto
UPDATE bots 
SET user_id = '7db32fb5-e69a-42ff-9157-f92fc30269a1'
WHERE id = '65f4a521-b310-4638-bfb3-522895406e30'
AND user_id IS NULL;

-- PASSO 3: Verificar quantos pagamentos tem user_id NULL deste bot
SELECT COUNT(*) as total_pagamentos_orfaos
FROM payments 
WHERE bot_id = '65f4a521-b310-4638-bfb3-522895406e30'
AND user_id IS NULL;

-- PASSO 4: Atualizar os pagamentos para ter o user_id correto
UPDATE payments 
SET user_id = '7db32fb5-e69a-42ff-9157-f92fc30269a1'
WHERE bot_id = '65f4a521-b310-4638-bfb3-522895406e30'
AND user_id IS NULL;

-- PASSO 5: Verificar se o flow também precisa do bot_id
SELECT id, name, bot_id 
FROM flows 
WHERE id = 'bd37e11c-705a-4bf5-81a0-ccefdd2fcad0';

-- PASSO 6: Atualizar o flow para ter o bot_id (se necessário)
-- CUIDADO: Só execute isso se souber qual bot deve ser associado ao flow
-- UPDATE flows 
-- SET bot_id = '65f4a521-b310-4638-bfb3-522895406e30'
-- WHERE id = 'bd37e11c-705a-4bf5-81a0-ccefdd2fcad0'
-- AND bot_id IS NULL;

-- PASSO 7: Verificação final - os pagamentos devem aparecer agora
SELECT id, bot_id, user_id, product_type, amount, status, created_at
FROM payments 
WHERE bot_id = '65f4a521-b310-4638-bfb3-522895406e30'
ORDER BY created_at DESC
LIMIT 10;
