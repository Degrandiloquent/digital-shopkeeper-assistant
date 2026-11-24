"""Fictional demo data. Nothing here is a real person, a real shop or a real payment.

Alex Corner Shop does not exist. The area label is a general neighbourhood, never a street address."""

BUSINESS = {
    "slug": "alex-corner-shop",
    "name": "Alex Corner Shop",
    "area_label": "Alexandra, Johannesburg",
    "timezone": "Africa/Johannesburg",
    "contact_note": "Demo shop with fictional data. No real contact details.",
    "hours": {
        "mon": {"closed": False, "open": "06:30", "close": "20:00"},
        "tue": {"closed": False, "open": "06:30", "close": "20:00"},
        "wed": {"closed": False, "open": "06:30", "close": "20:00"},
        "thu": {"closed": False, "open": "06:30", "close": "20:00"},
        "fri": {"closed": False, "open": "06:30", "close": "20:00"},
        "sat": {"closed": False, "open": "07:00", "close": "19:00"},
        "sun": {"closed": False, "open": "08:00", "close": "14:00"},
    },
}

OWNER_NAME = "Thandi Mokoena"
STAFF_NAME = "Sipho Nkosi"

# name, category, price in cents, final stock, low-stock threshold
#
# Milk is just above its threshold, so a reviewer can sell a few and watch it flip to "Low stock".
# Cooking oil starts low, so the dashboard warning is visible straight away.
PRODUCTS = [
    ("White bread (700g)", "Bakery", 1899, 24, 8),
    ("Fresh milk (1L)", "Dairy", 2549, 8, 6),
    ("Maize meal (5kg)", "Groceries", 6999, 12, 4),
    ("Bottled water (500ml)", "Drinks", 1099, 36, 10),
    ("Airtime voucher (R10)", "Airtime", 1000, 50, 10),
    ("Cooking oil (750ml)", "Groceries", 4799, 3, 5),
]

# A typical basket: (product name, quantity). Used to generate believable sales history.
BASKETS = [
    [("White bread (700g)", 1)],
    [("White bread (700g)", 1), ("Fresh milk (1L)", 1)],
    [("Maize meal (5kg)", 1)],
    [("Bottled water (500ml)", 2)],
    [("Airtime voucher (R10)", 1)],
    [("Airtime voucher (R10)", 2)],
    [("Fresh milk (1L)", 1), ("Bottled water (500ml)", 1)],
    [("Cooking oil (750ml)", 1), ("Maize meal (5kg)", 1)],
    [("White bread (700g)", 2)],
]
