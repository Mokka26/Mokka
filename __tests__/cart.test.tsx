import { render, screen } from "@testing-library/react";
import { CartProvider, useCart } from "@/context/CartContext";

function CartTestComponent() {
  const { items, totalItems, totalPrice } = useCart();

  return (
    <div>
      <p data-testid="total-items">{totalItems}</p>
      <p data-testid="total-price">{totalPrice.toFixed(2)}</p>
      <p data-testid="items-count">{items.length}</p>
    </div>
  );
}

describe("Cart Context", () => {
  it("initializes with empty cart", () => {
    render(
      <CartProvider>
        <CartTestComponent />
      </CartProvider>
    );

    expect(screen.getByTestId("total-items")).toHaveTextContent("0");
    expect(screen.getByTestId("total-price")).toHaveTextContent("0.00");
    expect(screen.getByTestId("items-count")).toHaveTextContent("0");
  });

  it("provides cart context to children", () => {
    render(
      <CartProvider>
        <CartTestComponent />
      </CartProvider>
    );

    expect(screen.getByTestId("total-items")).toBeInTheDocument();
    expect(screen.getByTestId("total-price")).toBeInTheDocument();
  });

  it("throws error when useCart is used outside CartProvider", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<CartTestComponent />)).toThrow(
      "useCart must be used within a CartProvider"
    );

    consoleSpy.mockRestore();
  });
});
