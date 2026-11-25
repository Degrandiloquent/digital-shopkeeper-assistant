"""add orders table

Revision ID: 20261125_02
Revises: 20261122_01
Create Date: 2026-11-25 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '20261125_02'
down_revision = '20261122_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'orders',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('customer_name', sa.String(length=120), nullable=False),
        sa.Column('customer_phone', sa.String(length=30), nullable=False),
        sa.Column('items', sa.JSON(), nullable=False),
        sa.Column('total_price_cents', sa.Integer(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'done', name='orderstatus', native_enum=False, length=32),
            nullable=False,
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_orders_status_created', 'orders', ['status', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_orders_status_created', table_name='orders')
    op.drop_table('orders')
