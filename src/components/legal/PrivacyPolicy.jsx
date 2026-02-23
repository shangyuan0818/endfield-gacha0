import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * 隐私政策页面
 */
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-zinc-500 hover:text-endfield-yellow transition-colors mb-8">
          <ArrowLeft size={16} />
          返回首页
        </a>

        <h1 className="text-2xl font-bold mb-2">隐私政策</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-500 mb-8">最后更新日期：2026年2月23日</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">一、引言</h2>
            <p>终末地抽卡分析器（以下简称"本工具"）是一款非官方的第三方抽卡数据分析工具，与游戏官方无关。我们重视您的隐私保护，本隐私政策旨在向您说明我们如何收集、使用、存储和保护您的个人信息。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">二、信息收集</h2>
            <p>为提供数据分析服务，我们可能收集以下信息：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>账号信息</strong>：注册时提供的电子邮箱地址和用户名。</li>
              <li><strong>游戏数据</strong>：通过您主动导入的游戏内抽卡记录数据，包括抽卡时间、角色名称、稀有度等。</li>
              <li><strong>设备信息</strong>：浏览器类型、操作系统等基本设备信息，用于优化用户体验。</li>
              <li><strong>使用数据</strong>：页面访问记录、功能使用情况等匿名统计数据。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">三、信息使用</h2>
            <p>我们收集的信息仅用于以下目的：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>提供抽卡数据分析和统计服务。</li>
              <li>实现跨设备数据同步功能。</li>
              <li>生成匿名化的全服统计数据（如平均出货抽数排行）。</li>
              <li>改进和优化本工具的功能和性能。</li>
              <li>发送与服务相关的通知（如系统维护通知）。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">四、信息存储与安全</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>您的数据存储在经过安全认证的云服务平台（Supabase）上。</li>
              <li>我们采用行级安全策略（RLS）确保用户只能访问自己的数据。</li>
              <li>密码经过加密处理存储，我们无法查看您的明文密码。</li>
              <li>数据传输全程使用 HTTPS 加密协议。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">五、信息共享</h2>
            <p>我们不会向任何第三方出售、交易或转让您的个人信息。以下情况除外：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>经过匿名化处理的统计数据（如全服平均出货）。</li>
              <li>法律法规要求或政府部门依法要求提供的情况。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">六、Cookie 与本地存储</h2>
            <p>本工具使用浏览器本地存储（localStorage）保存登录状态和用户偏好设置（如主题选择、当前查看的卡池等）。这些数据仅存储在您的设备上，不会上传至服务器。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">七、用户权利</h2>
            <p>您拥有以下权利：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>访问权</strong>：查看您存储在本工具中的所有个人数据。</li>
              <li><strong>更正权</strong>：修改您的账号信息。</li>
              <li><strong>删除权</strong>：请求删除您的账号及所有关联数据。</li>
              <li><strong>导出权</strong>：导出您的抽卡记录数据。</li>
            </ul>
            <p className="mt-2">如需行使上述权利，请通过工单系统联系我们。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">八、未成年人保护</h2>
            <p>本工具不针对未满14周岁的未成年人提供服务。如果您是未满14周岁的未成年人，请在监护人的陪同下使用本工具。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">九、隐私政策更新</h2>
            <p>我们可能会不时更新本隐私政策。更新后的政策将在本页面公布，重大变更时我们会通过站内公告通知您。继续使用本工具即表示您同意更新后的隐私政策。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">十、联系我们</h2>
            <p>如果您对本隐私政策有任何疑问或建议，可通过以下方式联系我们：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>站内工单系统</li>
              <li>GitHub Issues</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
