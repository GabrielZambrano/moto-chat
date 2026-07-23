-- AlterEnum
ALTER TYPE "EstadoPedido" ADD VALUE 'no_atendido';

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "recordatoriosEnviados" INTEGER NOT NULL DEFAULT 0;
