import enum


class UserRole(str, enum.Enum):
    SALES = "SALES"       # creates orders
    MANAGER = "MANAGER"   # approves/rejects orders
    ADMIN = "ADMIN"       # full access


class OrderStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"  # waiting for a manager decision
    APPROVED = "APPROVED"                  # transient: approved, being fulfilled
    REJECTED = "REJECTED"                  # manager rejected; no stock change
    COMPLETED = "COMPLETED"                # fulfilled; inventory deducted
    CANCELLED = "CANCELLED"                # cancelled by creator before completion


class StockMovementReason(str, enum.Enum):
    ORDER_FULFILLMENT = "ORDER_FULFILLMENT"
    RESTOCK = "RESTOCK"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"
    INITIAL = "INITIAL"
