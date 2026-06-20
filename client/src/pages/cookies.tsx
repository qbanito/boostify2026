import { Header } from "../components/layout/header";

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 pt-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>

          <div className="prose dark:prose-invert">
            <h2>1. About Cookies</h2>
            <p>
              Cookies are small files stored on your device that help us provide a better website experience.
            </p>

            <h2>2. Cookies We Use</h2>
            <p>
              We use these types of cookies:
            </p>
            <ul>
              <li>Essential cookies - for basic site functions</li>
              <li>Account cookies - to remember your login</li>
              <li>Preference cookies - to save your settings</li>
              <li>Analytics cookies - to improve our service</li>
            </ul>

            <h2>3. Your Choice</h2>
            <p>
              You can control cookies in your browser settings:
            </p>
            <ul>
              <li>Block all cookies</li>
              <li>Delete existing cookies</li>
              <li>Allow only certain cookies</li>
              <li>Set cookie preferences</li>
            </ul>

            <h2>4. Why We Use Cookies</h2>
            <p>
              Cookies help us:
            </p>
            <ul>
              <li>Keep you logged in</li>
              <li>Remember your preferences</li>
              <li>Make our site work better</li>
              <li>Understand how people use our site</li>
            </ul>

            <h2>5. Questions About Cookies?</h2>
            <p>
              Contact us if you have questions about how we use cookies on our site.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}