# LessonBloom user guide: roles and screens

Live: https://lessonbloom-148938648869.asia-southeast1.run.app. The UI is in Vietnamese and English; use the VI/EN switch at the top right.

## Roles at a glance

| Role | How they get in | Account? | Uses AI credits? |
|---|---|---|---|
| Teacher (demo) | "Dùng thử ngay" on the sign-in page | No: a key kept in that browser | 20 credits a day |
| Teacher (free) | Register with email and password, then type the 6-digit code LessonBloom emails | Yes | 30 credits a day |
| Teacher (Pro) | A Free teacher presses "Đăng ký dùng Pro"; the admin approves | Yes | Unlimited, within the app-wide safety guard |
| Pupil | `/learn`: type the class code (or scan the QR), tap your name | No: only a display name, set by the teacher | Never charged. Gemini's mistake hints are cached and recorded against the teacher |
| Admin | `/admin` with the admin key, or signed in as an admin email | Yes | — |

**Credit costs:**

| Action | Credits |
|---|---|
| New lesson | 10 |
| Video | 2 |
| New illustration | 1 |
| Slide rewrite | 1 |
| Comment drafts | 1 |
| AI reads the document | 0 |

## Teacher

1. **Sign-in page** (`/`): Đăng nhập / Đăng ký (sign in / register) and **Dùng thử ngay** (try the demo, no registration). Registering sends a **6-digit code** to the email (from LessonBloom); the account is created once the code is typed in. **Quên mật khẩu?** (forgot password, under the sign-in button) works the same way: code, then a new password. Every message, including errors and the code email, follows the VI/EN switch.
2. **Bài giảng** (Lessons, home): a "Cô dạy: …" line with a link to the profile; lesson cards with **subject filter (Tất cả môn / Toán / Tiếng Anh)** and class filter; each card has a **⋯ menu** (open, **Nhân bản** = a draft copy with the same slides, video and exercises, not assigned; In / PDF; delete; copies are numbered "(bản sao 2)"), this week's summary (a repeated mistake, a mastered skill), **Tạo bài giảng mới** (new lesson). A new account starts empty with the **Bắt đầu với LessonBloom** guide (see below).
   - **A new account starts empty** and shows **Bắt đầu với LessonBloom** (getting started): five steps that tick themselves off. The steps are create a class, create the first lesson, assign it, invite pupils, and check the learning summary. "Làm ngay" (do it now) opens the right screen, where a yellow hint says what to do and the button to press pulses. The guide can be hidden and shown again; when all steps are done it shrinks to one line.
   - Accounts made before 15 Oct still have the demo classes 2A/2B/2C: a note offers **Xoá dữ liệu mẫu** (clear sample data), which removes only the sample classes, pupils, results and lesson. Only "Dùng thử ngay" (the demo) comes with sample data now.
3. **Creating a lesson, 6 steps:**
   - **Demo only:** a note says how many new lessons are left today (counting AI credits), with **Đăng ký tài khoản miễn phí**, which opens registration. Accounts have no lesson cap (Free: 30 credits a day; Pro: unlimited).
   - **Tài liệu** (Document): paste text, drop a .txt/.docx, use a sample, or **take photos** of the textbook page or notes. Gemini copies the text from the photos into the box for the teacher to check. A lesson can use up to **5 photos**; each read costs 1 credit.
   - **Câu hỏi** (Questions): AI pre-fills the title, learning goal, length, class level and outputs; add an optional note to the AI.
   - *The AI works live:* slides, then exercises with self-check, then flashcards. The lesson is ready to review in about 1–2 minutes, and pictures keep arriving.
   - **Slide** (Slides): big-type slides, teacher notes, source quote; AI rewrite / simpler / new picture; manual edit.
   - **Video:** voice (female North/South, male North), speed, subtitles; make or remake; sections; download MP4.
   - **Bài tập** (Exercises): filter chips **Tất cả** (All) and each template with its count, plus flashcards and memory pairs; combined with the level (all / basic / good / advanced, each with its count). Each item shows its skill tag and solution, and 🛡️ marks items the AI fixed itself; edit or delete. Matching items show the words and pictures in mixed order, with the pairs only in the answer line. In English lessons, skill names and solutions are in English.
   - **Giao bài** (Assign): pick a class (classes of the lesson's subject come first), due date, retries, auto-suggestions; **Giao luôn cho lớp khác** (also assign to other classes); link, QR code, class code; **Gửi qua Zalo / tin nhắn** (on a phone: the share sheet; on a computer: a ready message to paste into the parents' Zalo group); who has joined.
   - On every lesson step: the title (long titles wrap to two lines) with **Đổi tên** (rename), **In / PDF** (the one print button, for every step), **Nhân bản** (duplicate, to adapt for another class) and **Xoá bài** (delete the lesson with its assignments and results, after a confirm).
   - **In / PDF** (also "Xuất PDF" on Slides and "In phiếu bài tập" on Exercises) asks what to print: slides (one per landscape page, with or without teacher notes); a worksheet with chosen templates (each shows its number of questions) and levels, single questions ticked or not ("Chọn từng câu"), and a "Họ và tên / Lớp / Ngày" line; **In tất cả** prints everything; the answer key with solutions on its own page; flashcards to cut out. The browser's print dialog then prints it or saves a PDF.
   - **Steps 1 and 2 stay viewable** once a lesson is made: the text it was made from, the file or photo names, and the answers to the questions, **read-only** (changing them would not change the slides). **Tạo bài mới từ tài liệu này** starts a new lesson from the same text.
4. **Lớp học** (Classes):
   - **Filter and subject:** subject filter; each class has a subject (Toán / Tiếng Anh / Cả hai), chosen when it is created.
   - **Numbers:** class size, joined, open assignments, the repeated mistake; progress per assignment.
   - **Xem tóm tắt** on an assigned lesson opens **Tổng kết bài đã giao**: the class first (finished / in progress / not started / joined; per skill the class label, pupils with a repeated slip, pupils secure, the common slip), then one row per pupil (parts opened: video, flashcards, exercises, memory game; right / not-yet answers per skill; repeated slip; retries; self-check; next practice). Click a pupil to see every question and each answer given. Teacher only; no scores or ranking.
   - **Pupils:** roster (names only); the class code and pupil link with Copy and **Gửi qua Zalo / tin nhắn**; add a class or pupils; print the class code.
   - **Edit:** **Sửa lớp** (rename, change subject) and **Xoá lớp** (delete the class with its pupils, assignments and results).
   - **One pupil:** click a pupil to open their page: every lesson assigned to the class, their skills (Đã vững / Đang luyện / Lỗi lặp lại, teacher only), recent mistakes, their self-check; **Đổi tên** (rename) or **Xoá khỏi lớp** (remove).
5. **Tóm tắt học tập** (Learning summary), for the chosen lesson, in two parts:
   - **1 · All classes:** a donut of skill results by level (counted by skill, not by pupil), a stacked bar per class with **Xem chi tiết ›**, and the skill × class table
   - **2 · One class:** pick a class; its donut, where tapping a level filters the table next to it; everything below counts only that class:
   - every skill per class labelled Đã vững / Đang luyện / Lỗi lặp lại (mastered / practising / repeated mistake)
   - **Kết quả từng học sinh** (each pupil's results): every pupil of the class, including those who have not started, with **Đã xong / Đang làm / Chưa làm** (finished / in progress / not started), questions done, a label per skill, the common slip, how it felt (the pupil's self-check) and last activity. A count at the top ("Đã xong 8/12 · Đang làm 2 · Chưa làm 2"), and **Nhắc các em chưa làm**: a ready message naming the pupils who have not started, for the parents' Zalo group. No scores
   - repeated mistakes with an example and the pupils' names; mastered skills
   - **Gợi ý lời nhận xét**: drafted on its own when the page opens, for **every pupil who did the lesson**, and kept (no new AI cost when reopened; **Soạn lại** drafts again). One card per pupil: skill labels, how it felt, an editable box (saved), **Sao chép**, **Ngắn hơn**; **Sao chép cả lớp**. Before any answers: "Chưa có lượt làm bài để nhận xét".
6. **Tiêu chí tóm tắt** (Criteria): the thresholds behind the labels, with a live preview.
7. **Lượt dùng AI** (AI usage, ⚡ in the top bar): credits left today, 30-day history with actual AI cost, costs per action, Pro request.
8. **Tài khoản của tôi** (My account / profile: click the name or avatar in the top bar, or "Đổi môn và lớp trong Hồ sơ" on the home page): the **display name** (shown in the top bar and to pupils); the **subject taught** (Toán / Tiếng Anh / Cả hai, the default for new lessons and classes); the teacher's **classes**; the **interface language**; how they **sign in** and Sign out; **change the password** (current password, then the new one twice); **Quên mật khẩu hiện tại?** sends a 6-digit code to the account email to set a new password without the old one. A demo workspace can change its name only.

### Getting started (new accounts)

New accounts start empty. Only the "Dùng thử ngay" demo has sample data. The home page shows **Bắt đầu với LessonBloom**, five steps that tick themselves off from the teacher's own data:

1. Create a class
2. Create the first lesson
3. Assign it
4. Invite pupils (a pupil has joined)
5. Check the learning summary (a pupil has practised)

**Làm ngay** opens the right screen, where a yellow hint says what to do and the button to press pulses. The guide can be hidden and shown again; when all steps are done it shrinks to one line. Accounts made before 15 Oct that still have the demo classes see **Xoá dữ liệu mẫu** (clear sample data).

## Pupil (phone or tablet)

1. **Vào học** (Join): class code, then tap your name.
2. **Bài hôm nay** (Today's lesson): a gentle reminder of last time's most frequent slip; 4 activities.
3. **Xem video** (Watch): the lesson video, or the slides with read-aloud. On every activity, the title and instruction show up to two lines; a tap shows all of it.
4. **Thẻ nhớ** (Flashcards): flip, listen, Đã nhớ (got it) / Ôn lại (review again).
5. **Làm bài tập** (Practice): 8 formats. A wrong answer shows "Gần đúng rồi! Thử lại nhé" plus a hint and lets them retry; a right answer shows praise and the explanation.
6. **Lật thẻ** (Memory game): find the pairs.
7. **Con làm xong rồi!** (Done): a burst of confetti; more practice on the same skill, or a harder challenge; self-check Dễ / Vừa / Khó (easy / OK / hard).
   - **Bố mẹ ơi!** (Dear parents): a card for the parent holding the phone. It says what the child did today (watched the video, reviewed N flashcards, did N exercises, played the memory game, how it felt), never a score. **Gửi cho gia đình** shares it (phone share sheet) or copies it for the family chat.
   - Reaching this screen counts as **finished** for the teacher, even if no face is tapped. Back on **Bài hôm nay**, a green banner says the lesson is finished; practising more is still possible.

**Pupils never see** scores, percentages, rankings or labels.

## Admin

`/admin` shows:
- AI cost this month, counted from real model usage
- the spending guard: $40/month and $10/day, enforced by the app
- links to Cloud Billing
- usage by model, day and task
- **Users:** plan, lessons, credits and cost per user; Pro requests highlighted; Make Pro / Set Free

## Try it yourself (5 minutes)

1. **Teacher:** open the live URL and choose **Register**, using your own email. Type the 6-digit code from the LessonBloom email; you are signed in straight away, to an empty account with the guide.
2. **Class:** guide step 1 → name the class (e.g. 2A), pick the subject, paste a few first names → Lưu (save).
3. **Lesson:** guide step 2 → use the sample *Toán lớp 2 · Cộng có nhớ* or upload a .docx → Tiếp tục → Tạo bài giảng. In 1–2 minutes you can review the slides; pictures keep arriving.
4. **Video:** step 4, choose a voice, then Tạo video (about 1–2 minutes).
5. **Assign:** step 6, choose your class, then Giao bài. Note the class code, or press Gửi qua Zalo.
6. **Pupil:** on your phone, open the link (or `/learn` and type the code) and tap a name. Practise and answer one question wrongly on purpose to see the hint.
7. **Results:** back as the teacher, open Tóm tắt học tập, then your class; press "Soạn gợi ý nhận xét" (draft comments). In Lớp học, click the pupil to see their page.

Or press **Dùng thử ngay** to explore a demo workspace that already has classes 2A/2B/2C, a lesson and sample results.
7. **Admin:** open `/admin` while signed in with an email listed in `LB_ADMIN_EMAILS`, or with the admin key, to see your account, credits and cost.
