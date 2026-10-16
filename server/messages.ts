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
  noPhotos: { vi: 'Cô chọn ít nhất một ảnh nhé.', en: 'Please choose at least one photo.' },
  tooManyPhotos: (n: number): Msg => ({ vi: `Mỗi bài dùng tối đa ${n} ảnh. Cô bỏ bớt ảnh${n < 5 ? ' (gói Pro dùng được 5 ảnh)' : ''} nhé.`, en: `A lesson can use up to ${n} photos. Please remove some${n < 5 ? ' (Pro allows 5)' : ''}.` }),
  photoBad: { vi: 'Ảnh này chưa đọc được (chỉ nhận JPG, PNG, WEBP, mỗi ảnh dưới 4 MB). Cô chụp lại hoặc chọn ảnh khác nhé.', en: 'This photo could not be read (JPG, PNG or WEBP only, under 4 MB each). Please retake it or pick another.' },
  photoNoText: { vi: 'AI chưa thấy chữ của bài học trong ảnh. Cô chụp rõ trang sách hoặc giáo án, đủ sáng, không bị nghiêng nhé.', en: 'The AI could not find lesson text in the photo. Take a clear, well-lit, straight photo of the page or notes.' },
  notLesson: { vi: 'Nội dung này chưa giống một bài học (ví dụ chỉ có số, chữ ngẫu nhiên hoặc vài từ rời rạc). Cô dán nội dung bài có ý nghĩa: tên bài, kiến thức cần học, ví dụ, bài tập nhé.', en: 'This does not look like a lesson yet (only numbers, random letters or a few unrelated words). Please paste real lesson content: the topic, what pupils learn, examples, exercises.' },
  sourceShort: { vi: 'Cô dán nội dung bài học (ít nhất vài câu) nhé.', en: 'Please paste the lesson content (at least a few sentences).' },
  missingSource: { vi: 'Thiếu nội dung bài hoặc câu trả lời ở bước 2.', en: 'The lesson text or the step 2 answers are missing.' },
  notReady: { vi: 'Bài giảng đang được soạn, cô đợi một chút nhé.', en: 'The lesson is still being prepared. Please wait a moment.' },
  codeNotFound: { vi: 'Không tìm thấy mã lớp. Con hỏi cô giáo nhé.', en: 'We can\'t find that class code. Please ask your teacher.' },
  badRequest: { vi: 'Yêu cầu chưa hợp lệ.', en: 'Invalid request.' },
  forbidden: { vi: 'Không có quyền truy cập.', en: 'Access denied.' },
  server: { vi: 'Máy chủ gặp lỗi, cô thử lại sau ít phút nhé.', en: 'Something went wrong on the server. Please try again in a few minutes.' },

  // sign-up and password reset with an emailed 6-digit code
  badEmail: { vi: 'Email chưa đúng định dạng (ví dụ: ten@truong.edu.vn).', en: 'That email address looks wrong (e.g. name@school.edu).' },
  nameMissing: { vi: 'Cô nhập tên hiển thị nhé.', en: 'Please enter a display name.' },
  weakPassword: { vi: 'Mật khẩu cần ít nhất 6 ký tự.', en: 'The password needs at least 6 characters.' },
  emailInUse: { vi: 'Email này đã có tài khoản. Cô đăng nhập, hoặc bấm "Quên mật khẩu?" nhé.', en: 'This email already has an account. Sign in, or use "Forgot password?".' },
  codeWait: (s: number): Msg => ({ vi: `Mã vừa được gửi. Cô đợi ${s} giây rồi gửi lại nhé.`, en: `A code was just sent. Please wait ${s} seconds before asking again.` }),
  codeLimit: { vi: 'Đã gửi quá nhiều mã. Cô thử lại sau một giờ nhé.', en: 'Too many codes sent. Please try again in an hour.' },
  codeWrong: { vi: 'Mã chưa đúng. Cô kiểm tra lại 6 số trong email nhé.', en: 'That code is not right. Please check the 6 digits in the email.' },
  codeExpired: { vi: 'Mã đã hết hạn hoặc nhập sai quá nhiều lần. Cô bấm "Gửi lại mã" nhé.', en: 'The code has expired or was entered wrongly too many times. Press "Send a new code".' },
  mailFailed: { vi: 'Chưa gửi được email. Cô kiểm tra địa chỉ email rồi thử lại nhé.', en: 'The email could not be sent. Please check the address and try again.' },
  noAccounts: { vi: 'Đăng ký tài khoản chưa bật. Cô dùng thử bản demo nhé.', en: 'Accounts are not switched on. Please try the demo.' },

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
