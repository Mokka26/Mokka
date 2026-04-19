"use client";

export default function NewsletterForm() {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <input type="email" placeholder="jouw@email.nl" className="input-field flex-1 text-center sm:text-left" />
      <button type="submit" className="btn-primary whitespace-nowrap">Aanmelden</button>
    </form>
  );
}
