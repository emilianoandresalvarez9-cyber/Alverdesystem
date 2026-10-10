-- RF-68: tipo de movimiento propio para los traspasos entre sucursales, así los reportes
-- no los confunden con ajustes. Va en una migración separada porque un valor nuevo de
-- un enum no se puede usar en la misma transacción en la que se agrega.
alter type public.stock_movement_kind add value if not exists 'transfer';
