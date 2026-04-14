import React from 'react';
import { ENGLISH_COMMUNITY_DISCORD_URL } from '../../constants/community';

export default function PrivacyPolicyEnglishContent() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
        <p>Endfield Gacha Analyzer (&quot;the Tool&quot;) is an unofficial third-party pull history analysis service and is not affiliated with the game operator. We take privacy seriously. This Privacy Policy explains what information we collect, how we use it, how it is stored, and how we protect it.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
        <p>To provide analysis features, we may collect the following categories of information:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Account information</strong>: the email address and username you provide during registration.</li>
          <li><strong>Game data</strong>: pull history records you actively import, including pull time, item or character name, rarity, and related banner fields.</li>
          <li><strong>Device information</strong>: basic technical data such as browser type and operating system, used to improve the product experience.</li>
          <li><strong>Usage data</strong>: anonymized statistics such as page visits and feature usage.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. How We Use Information</h2>
        <p>We use the collected information only for the following purposes:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Provide pull data analysis and statistics.</li>
          <li>Enable cross-device data sync.</li>
          <li>Generate anonymized aggregate statistics, such as global average pull rankings.</li>
          <li>Handle account recovery requests, manual verification, and temporary password issuance.</li>
          <li>Improve the Tool&apos;s functionality and performance.</li>
          <li>Send service-related notices, such as maintenance announcements.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">4. Storage and Security</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Your data is stored on a security-focused cloud platform, currently Supabase.</li>
          <li>We rely on Row Level Security (RLS) to ensure users can access only their own records.</li>
          <li>Passwords are stored in encrypted form. We do not have access to your plaintext password.</li>
          <li>Data in transit is protected with HTTPS.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">5. Information Sharing</h2>
        <p>We do not sell, trade, or transfer your personal information to third parties, except in the following situations:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Anonymized statistical outputs, such as global average pull metrics.</li>
          <li>Cases required by applicable law or by lawful requests from government authorities.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">6. Cookies and Local Storage</h2>
        <p>The Tool uses browser local storage (`localStorage`) to keep necessary UI state and read-only cache snapshots. These values stay on your device to improve loading speed and cross-page continuity. Writing to `localStorage` does not, by itself, upload data to our servers.</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Interface preferences</strong>: theme mode, selected banner, selected game account, desktop or mobile preference, captcha mode, and share theme.</li>
          <li><strong>Local simulator state</strong>: pity counters, resource settings, intel books, and animation toggles isolated per site user and game account.</li>
          <li><strong>Read-only cache snapshots</strong>: site config, public bootstrap data, character cache, and parts of global statistics used for offline fallback and fewer repeated requests.</li>
        </ul>
        <p className="mt-2">Imported pull history, cloud-synced banner data, and account profile data are not considered server-backed solely because they exist in local storage. For signed-in users, the authoritative dataset remains the protected records stored in Supabase.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">7. Your Rights</h2>
        <p>You have the following rights:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li><strong>Access</strong>: review the personal data stored for you inside the Tool.</li>
          <li><strong>Correction</strong>: update your account information.</li>
          <li><strong>Deletion</strong>: regular users can self-delete their own account from Settings. If you cannot log in, you may submit an account recovery or deletion request for manual review.</li>
          <li><strong>Export</strong>: export your pull history. JSON and CSV exports are meant for backup and re-import and may include structured fields such as banner, timestamp, and game account data.</li>
          <li><strong>Share control</strong>: built-in share cards and share text are desensitized by default and do not include account identifiers, UID, exact timestamps, or raw pull-by-pull details.</li>
        </ul>
        <p className="mt-2">To exercise these rights, please use the in-app Settings page, export tools, or ticket system first. Account recovery and temporary password requests in the English flow are currently handled through our Discord server for manual review by the super admin: <a href={ENGLISH_COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-endfield-yellow hover:underline break-all">{ENGLISH_COMMUNITY_DISCORD_URL}</a>.</p>
        <p className="mt-2">After a self-service deletion completes, the current account, pull history, self-created banners, tickets, and ticket replies are removed together. Future recalculated global statistics will no longer include those pull records. Files you already exported, content already shared outside the site, and the minimum account recovery handling logs retained for security auditing are outside the scope of in-site recovery.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">8. Protection of Minors</h2>
        <p>The Tool is not intended for children under 14 years old. If you are under 14, please use the Tool only under the supervision of a parent or legal guardian.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">9. Policy Updates</h2>
        <p>We may update this Privacy Policy from time to time. Updated versions will be published on this page. For material changes, we may also provide notice through in-site announcements. Continued use of the Tool means you accept the updated policy.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">10. Contact</h2>
        <p>If you have any questions or suggestions about this Privacy Policy, you can contact us through:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>In-site ticket system</li>
          <li><a href={ENGLISH_COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-endfield-yellow hover:underline break-all">Discord server</a> for account recovery, temporary passwords, and support</li>
          <li>GitHub Issues</li>
        </ul>
      </section>
    </div>
  );
}
