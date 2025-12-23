/**
 * the_synapsys Website - Landing Page
 *
 * Compliance References:
 * - eIDAS 2.0 Art. 45, 64
 * - ISO 27001 A.12.4.1
 * - GDPR Art. 5
 */

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary-400 to-purple-500 bg-clip-text text-transparent">
          the_synapsys
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 mb-4">
          EUDI Wallet Relying Party
        </p>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
          European Digital Identity Wallet verification and management platform.
          Secure, compliant, and ready for the digital future.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
            Get Started
          </button>
          <button className="border border-gray-700 hover:border-primary-600 text-gray-300 px-8 py-3 rounded-lg font-semibold transition-colors">
            Learn More
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-12">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-primary-600 transition-colors">
            <div className="text-primary-500 text-4xl mb-4">🔒</div>
            <h3 className="text-2xl font-semibold mb-4">Secure Verification</h3>
            <p className="text-gray-400">
              End-to-end encrypted verification process ensuring maximum
              security for digital identity credentials.
            </p>
          </div>

          <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-primary-600 transition-colors">
            <div className="text-primary-500 text-4xl mb-4">⚡</div>
            <h3 className="text-2xl font-semibold mb-4">
              Real-time Processing
            </h3>
            <p className="text-gray-400">
              Instant credential verification and validation with minimal
              latency for optimal user experience.
            </p>
          </div>

          <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-primary-600 transition-colors">
            <div className="text-primary-500 text-4xl mb-4">📊</div>
            <h3 className="text-2xl font-semibold mb-4">
              Comprehensive Dashboard
            </h3>
            <p className="text-gray-400">
              Intuitive management interface for monitoring, analytics, and
              compliance reporting.
            </p>
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-12">
          Compliance & Security
        </h2>
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xl font-bold text-primary-500 mb-3">
                  eIDAS 2.0
                </h3>
                <ul className="text-gray-400 space-y-2">
                  <li>• Article 45</li>
                  <li>• Article 64</li>
                  <li>• Qualified Trust Services</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-primary-500 mb-3">
                  ISO 27001
                </h3>
                <ul className="text-gray-400 space-y-2">
                  <li>• A.12.4.1 Event Logging</li>
                  <li>• Information Security</li>
                  <li>• Risk Management</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-primary-500 mb-3">
                  GDPR
                </h3>
                <ul className="text-gray-400 space-y-2">
                  <li>• Article 5 Principles</li>
                  <li>• Data Protection</li>
                  <li>• Privacy by Design</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Get in Touch</h2>
          <p className="text-gray-400 mb-8">
            Ready to implement EUDI Wallet verification? Contact us to learn
            more about our solutions.
          </p>
          <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700">
            <p className="text-lg mb-4">
              <span className="text-gray-500">Email:</span>{" "}
              <a
                href="mailto:contact@the-synapsys.eu"
                className="text-primary-500 hover:text-primary-400"
              >
                contact@the-synapsys.eu
              </a>
            </p>
            <p className="text-sm text-gray-500">
              Week 1 - Bootstrap Phase Complete ✅
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="container mx-auto px-6 text-center text-gray-500">
          <p>&copy; 2024 the_synapsys - EUDI Wallet Relying Party</p>
          <p className="text-sm mt-2">v0.1.0</p>
        </div>
      </footer>
    </main>
  );
}
