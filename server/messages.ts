// Every message the server shows to people, in Vietnamese and English. API errors carry both
// ({ error, errorEn, code }) and the browser shows the one matching the chosen language.
export type Msg = { vi: string; en: string };

export const MSG = {
  signInExpired: { vi: 'Phiên đăng nhập đã hết hạn, cô đăng nhập lại nhé.', en: 'Your sign-in has expired. Please sign in again.' },
  noWorkspace: { vi: 'Không tìm thấy tài khoản. Cô đăng nhập lại hoặc bấm "Dùng thử ngay" nhé.', en: 'Workspace not found. Please sign in again or start the demo.' },
  verify: { vi: 'Cô mở email và bấm đường link xác nhận trước khi dùng AI nhé.', en: 'Please confirm your email address (open the link in the email we sent) before using AI.' },
  credits: (used: number, limit: number, demo: boolean): Msg => (demo
    ? { vi: `Hôm nay cô đã dùng ${used}/${limit} lượt AI của bản dùng thử. Lượt được làm mới vào ngày mai, hoặc cô đăng ký tài khoản miễn phí để có 30 lượt mỗi ngày.`,
      en: `You have used ${used}/${limit} AI credits in the demo today. Credits reset tomorrow, or register a free account for 30 credits a day.` }
    : { vi: `Hôm nay cô đã dùng ${used}/${limit} lượt AI của gói miễn phí. Lượt được làm mới vào ngày mai, hoặc cô đăng ký Pro để tạo không giới hạn.`,
      en: `You have used ${used}/${limit} AI credits on the free plan today. Credits reset tomorrow, or request Pro for unlimited creation.` }),
  month: { vi: 'LessonBloom đã dùng hết hạn mức AI của tháng này. Cô thử lại vào tháng sau nhé.', en: 'LessonBloom has used this month\'s AI allowance. Please try again next month.' },
  day: { vi: 'LessonBloom đã dùng hết hạn mức AI hôm nay. Cô thử lại vào ngày mai nhé.', en: 'LessonBloom has used today\'s AI allowance. Please try again tomorrow.' },
  demoPerIp: { vi: 'Hôm nay mạng này đã tạo quá nhiều bản dùng thử. Cô đăng ký tài khoản miễn phí để dùng tiếp nhé.', en: 'Too many demo workspaces from this network today. Please register a free account to continue.' },
  demoLessons: (n: number): Msg => ({ vi: `Mỗi ngày bản dùng thử cho tạo ${n} bài. Cô đăng ký tài khoản miễn phí để tạo thêm nhé.`, en: `The demo allows ${n} new lessons a day. Register a free account to create more.` }),
  needAccount: { vi: 'Cô đăng ký tài khoản (miễn phí) trước nhé.', en: 'Please register a free account first.' },
  className: { vi: 'Cô nhập tên lớp nhé.', en: 'Please enter a class name.' },
  notFound: { vi: 'Không tìm thấy mục này (có thể đã bị xoá).', en: 'Not found (it may have been deleted).' },
  sourceShort: { vi: 'Cô dán nội dung bài học (ít nhất vài câu) nhé.', en: 'Please paste the lesson content (at least a few sentences).' },
  missingSource: { vi: 'Thiếu nội dung bài hoặc câu trả lời ở bước 2.', en: 'The lesson text or the step 2 answers are missing.' },
  notReady: { vi: 'Bài giảng đang được soạn, cô đợi một chút nhé.', en: 'The lesson is still being prepared. Please wait a moment.' },
  codeNotFound: { vi: 'Không tìm thấy mã lớp. Con hỏi cô giáo nhé.', en: 'We can\'t find that class code. Please ask your teacher.' },
  badRequest: { vi: 'Yêu cầu chưa hợp lệ.', en: 'Invalid request.' },
  forbidden: { vi: 'Không có quyền truy cập.', en: 'Access denied.' },
  server: { vi: 'Máy chủ gặp lỗi, cô thử lại sau ít phút nhé.', en: 'Something went wrong on the server. Please try again in a few minutes.' },

  // lesson build progress (shown live in step 3)
  pReading: { vi: 'Đang đọc tài liệu và soạn slide…', en: 'Reading the document and writing slides…' },
  pSlides: (n: number): Msg => ({ vi: `Đã có ${n} slide. Đang soạn bài tập theo mẫu và tự kiểm tra đáp án…`, en: `${n} slides done. Writing exercises from the templates and checking the answers…` }),
  pExercises: (n: number, skills: number, fixed: number): Msg => ({
    vi: `Đã có ${n} câu cho ${skills} dạng bài; máy đã tự sửa ${fixed} câu. Đang làm thẻ nhớ…`,
    en: `${n} exercises for ${skills} skills; ${fixed} fixed by the self-check. Making flashcards…` }),
  pDone: { vi: 'Xong phần chữ! Cô xem lại slide và bài tập; hình minh họa đang được vẽ thêm.', en: 'Text is ready! Review the slides and exercises; pictures are still being drawn.' },
  pRewrite: (round: number, n: number): Msg => ({ vi: `Tự kiểm tra lượt ${round}: viết lại ${n} câu`, en: `Self-check round ${round}: rewriting ${n} items` }),
  pDropped: (n: number, rounds: number): Msg => ({ vi: `Bỏ ${n} câu vẫn chưa đạt sau ${rounds} lượt sửa`, en: `Dropped ${n} items that still failed after ${rounds} rounds` }),
  pNoPicture: (n: number): Msg => ({ vi: `Slide ${n}: chưa vẽ được hình, cô có thể bấm "Đổi hình minh họa"`, en: `Slide ${n}: no picture yet; you can press "New illustration"` }),
} as const;

export const errorBody = (m: Msg, code: string, extra: Record<string, unknown> = {}) => ({ error: m.vi, errorEn: m.en, code, ...extra });
