import { render, screen } from "@testing-library/react";
import ProductCard from "@/components/ProductCard";

const mockProduct = {
  id: "test-1",
  name: "Test Product",
  price: 199.99,
  category: "furniture",
  images: JSON.stringify(["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800"]),
};

describe("ProductCard", () => {
  it("renders product name", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText("Test Product")).toBeInTheDocument();
  });

  it("renders product price", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText("€199.99")).toBeInTheDocument();
  });

  it("renders product category", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText("furniture")).toBeInTheDocument();
  });

  it("links to the product detail page", () => {
    render(<ProductCard product={mockProduct} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/products/test-1");
  });
});
