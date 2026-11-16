import { defineMessages } from "@seance/ui";

/** How to get mail out of common providers as .mbox or .eml. Kept apart: it is long. */
export const exportGuide = defineMessages(
  {
    title: "How to export your mail",
    intro:
      "Inbox Exorcist reads files, never your account, so it needs no password. Every common provider can give you an .mbox or .eml file:",
    thunderbirdStep:
      "In Thunderbird, install the ImportExportTools NG add-on, right-click the folder and choose Export folder → as mbox. Drop that file here.",
    providers: [
      {
        name: "Gmail",
        steps: [
          "Open takeout.google.com, click Deselect all, then tick only Mail.",
          "Create the export. Google emails you a download link, often within hours.",
          "Unzip it and drop the .mbox file inside (a zip under 500 MB also works).",
        ],
      },
      {
        name: "Outlook.com, Hotmail, Microsoft 365",
        steps: [
          "Outlook's own exports (.pst, .olm) are not supported.",
          "Add the account to Thunderbird (it signs in with Microsoft), let the folder download, then export it.",
        ],
      },
      {
        name: "Yahoo Mail",
        steps: [
          "In Yahoo Account security, create an app password.",
          "Add the account to Thunderbird with that password, then export the folder.",
        ],
      },
      {
        name: "iCloud Mail (Apple Mail)",
        steps: [
          "In Apple Mail, select a mailbox, then Mailbox → Export Mailbox.",
          "It saves a folder. Drop the file named mbox inside it.",
        ],
      },
      {
        name: "QQ Mail",
        steps: [
          "In QQ Mail Settings → Account, turn on the IMAP/SMTP service and copy the authorization code.",
          "Add the account to Thunderbird, using the authorization code as the password, then export the folder.",
        ],
      },
      {
        name: "163 / 126 Mail",
        steps: [
          "In Settings → POP3/SMTP/IMAP, turn on IMAP and copy the authorization code.",
          "Add the account to Thunderbird with that code, then export the folder.",
        ],
      },
    ],
    singleMails:
      "For a few messages, drag them from Apple Mail or Thunderbird to your desktop. That makes .eml files you can drop here.",
  },
  {
    title: "如何导出你的邮件",
    intro:
      "收件箱驱魔只读取文件，从不登录你的账号，所以不需要密码。常见邮箱都能导出 .mbox 或 .eml 文件：",
    thunderbirdStep:
      "在 Thunderbird 中安装 ImportExportTools NG 扩展，右键点击文件夹，选择“导出文件夹 → mbox 格式”，再把导出的文件拖到这里。",
    providers: [
      {
        name: "Gmail",
        steps: [
          "打开 takeout.google.com，点击“取消全选”，只勾选“邮件”。",
          "创建导出。Google 会把下载链接发到你的邮箱，通常要等几个小时。",
          "解压后把里面的 .mbox 文件拖到这里（小于 500 MB 的 zip 也可以直接拖）。",
        ],
      },
      {
        name: "Outlook.com、Hotmail、Microsoft 365",
        steps: [
          "不支持 Outlook 自带的导出格式（.pst、.olm）。",
          "把账号添加到 Thunderbird（用微软账号登录），等文件夹下载完成后再导出。",
        ],
      },
      {
        name: "Yahoo 邮箱",
        steps: [
          "在 Yahoo 账号安全设置中生成一个“应用密码”。",
          "用这个密码把账号添加到 Thunderbird，然后导出文件夹。",
        ],
      },
      {
        name: "iCloud 邮件（Apple 邮件）",
        steps: [
          "在 Apple 邮件中选中一个邮箱，然后选择菜单“邮箱 → 导出邮箱”。",
          "它会保存一个文件夹，把其中名为 mbox 的文件拖到这里。",
        ],
      },
      {
        name: "QQ 邮箱",
        steps: [
          "在 QQ 邮箱“设置 → 账户”中开启 IMAP/SMTP 服务，并复制授权码。",
          "把账号添加到 Thunderbird，密码处填写授权码，然后导出文件夹。",
        ],
      },
      {
        name: "163 / 126 邮箱",
        steps: [
          "在“设置 → POP3/SMTP/IMAP”中开启 IMAP 服务，并复制授权码。",
          "用授权码把账号添加到 Thunderbird，然后导出文件夹。",
        ],
      },
    ],
    singleMails:
      "如果只需要几封邮件，可以直接从 Apple 邮件或 Thunderbird 拖到桌面，得到 .eml 文件后再拖到这里。",
  },
);
