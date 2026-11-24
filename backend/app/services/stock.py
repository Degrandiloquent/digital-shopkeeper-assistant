from app.models import Product


def stock_state(quantity: int, threshold: int) -> str:
    """Out of stock at zero, low when at or below the owner's threshold, otherwise in stock."""
    if quantity <= 0:
        return "out_of_stock"
    if quantity <= threshold:
        return "low_stock"
    return "in_stock"


def product_stock_state(product: Product) -> str:
    return stock_state(product.stock_qty, product.low_stock_threshold)
