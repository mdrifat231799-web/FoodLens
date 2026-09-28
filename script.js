/* =========================================================
   FoodLens — Final Main JavaScript
   Real AI Food Scanner + Dashboard + History + Health
   Bangladesh-friendly UI
========================================================= */


/* =========================================================
   GLOBAL CONFIG
========================================================= */

const API_BASE_URL =
  window.location.protocol === "file:"
    ? "http://127.0.0.1:8000"
    : "";


const DEVICE_ID_KEY =
  "foodlens_device_id";


const STORAGE_KEYS = {

  password:
    "foodlens_password",

  profile:
    "foodlens_profile",

  history:
    "foodlens_history"

};


const FREE_SCAN_LIMIT = 5;

const MAX_HISTORY_ITEMS = 30;

const HISTORY_IMAGE_MAX_SIZE = 420;


/*
  Current scanner state
*/
let selectedImageData = null;

let selectedImageFile = null;

let currentScanStatus = null;

let isAnalyzing = false;


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    getOrCreateDeviceId();

    initializeLock();

    loadProfile();

    updateDashboard();

    renderHistory();

    loadScanStatus();

  }
);


/* =========================================================
   DEVICE ID
========================================================= */

function getOrCreateDeviceId() {

  let deviceId =
    localStorage.getItem(
      DEVICE_ID_KEY
    );


  if (deviceId) {

    return deviceId;

  }


  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {

    deviceId =
      window.crypto.randomUUID();

  } else {

    deviceId =
      "fl_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 12);

  }


  try {

    localStorage.setItem(
      DEVICE_ID_KEY,
      deviceId
    );

  } catch (error) {

    console.error(
      "Device ID save error:",
      error
    );

  }


  return deviceId;

}


/* =========================================================
   API HEADERS
========================================================= */

function getAPIHeaders() {

  return {

    "X-Device-ID":
      getOrCreateDeviceId()

  };

}


/* =========================================================
   PASSWORD LOCK
========================================================= */

function initializeLock() {

  const savedPassword =
    localStorage.getItem(
      STORAGE_KEYS.password
    );


  const setupArea =
    document.getElementById(
      "setupPasswordArea"
    );


  const loginArea =
    document.getElementById(
      "loginPasswordArea"
    );


  if (savedPassword) {

    if (setupArea) {

      setupArea.classList.add(
        "hidden"
      );

    }


    if (loginArea) {

      loginArea.classList.remove(
        "hidden"
      );

    }

  } else {

    if (setupArea) {

      setupArea.classList.remove(
        "hidden"
      );

    }


    if (loginArea) {

      loginArea.classList.add(
        "hidden"
      );

    }

  }

}


/* =========================================================
   CREATE PASSWORD
========================================================= */

function createPassword() {

  const passwordElement =
    document.getElementById(
      "newPassword"
    );


  const confirmElement =
    document.getElementById(
      "confirmPassword"
    );


  const password =
    passwordElement
      ? passwordElement.value.trim()
      : "";


  const confirm =
    confirmElement
      ? confirmElement.value.trim()
      : "";


  if (!password) {

    showLockMessage(
      "একটি password তৈরি করুন।"
    );

    return;

  }


  if (password.length < 4) {

    showLockMessage(
      "Password কমপক্ষে ৪ অক্ষরের হতে হবে।"
    );

    return;

  }


  if (password !== confirm) {

    showLockMessage(
      "দুটি password একই নয়।"
    );

    return;

  }


  try {

    localStorage.setItem(
      STORAGE_KEYS.password,
      password
    );

  } catch (error) {

    showLockMessage(
      "Password save করা যায়নি। Browser storage check করুন।"
    );

    return;

  }


  unlockApplication();


  showToast(
    "Password সফলভাবে তৈরি হয়েছে।"
  );

}


/* =========================================================
   PASSWORD LOGIN
========================================================= */

function unlockApp() {

  const input =
    document.getElementById(
      "loginPassword"
    );


  const entered =
    input
      ? input.value
      : "";


  const saved =
    localStorage.getItem(
      STORAGE_KEYS.password
    );


  if (!entered) {

    showLockMessage(
      "আপনার password দিন।"
    );

    return;

  }


  if (!saved) {

    showLockMessage(
      "Password সেট করা হয়নি।"
    );

    return;

  }


  if (entered !== saved) {

    showLockMessage(
      "Password সঠিক নয়।"
    );

    return;

  }


  unlockApplication();

}


/* =========================================================
   UNLOCK APPLICATION
========================================================= */

function unlockApplication() {

  const lockScreen =
    document.getElementById(
      "lockScreen"
    );


  const app =
    document.getElementById(
      "app"
    );


  if (lockScreen) {

    lockScreen.classList.add(
      "hidden"
    );

  }


  if (app) {

    app.classList.remove(
      "hidden"
    );

  }


  clearLockMessage();

  loadScanStatus();

  updateDashboard();

}


/* =========================================================
   LOCK APPLICATION
========================================================= */

function lockApp() {

  const app =
    document.getElementById(
      "app"
    );


  const lockScreen =
    document.getElementById(
      "lockScreen"
    );


  if (app) {

    app.classList.add(
      "hidden"
    );

  }


  if (lockScreen) {

    lockScreen.classList.remove(
      "hidden"
    );

  }


  const passwordInput =
    document.getElementById(
      "loginPassword"
    );


  if (passwordInput) {

    passwordInput.value = "";

    passwordInput.focus();

  }


  clearLockMessage();

}


/* =========================================================
   LOCK MESSAGE
========================================================= */

function showLockMessage(
  message
) {

  const element =
    document.getElementById(
      "lockMessage"
    );


  if (element) {

    element.textContent =
      message;

  }

}


function clearLockMessage() {

  const element =
    document.getElementById(
      "lockMessage"
    );


  if (element) {

    element.textContent = "";

  }

}


/* =========================================================
   OWNER ACCESS
========================================================= */

async function activateOwnerAccess() {

  const code =
    window.prompt(
      "👑 Owner Access\n\nOwner activation code দিন:"
    );


  if (
    code === null
  ) {

    return;

  }


  const activationCode =
    code.trim();


  if (!activationCode) {

    showLockMessage(
      "Owner activation code দিন।"
    );

    return;

  }


  try {

    showLockMessage(
      "Owner Access যাচাই করা হচ্ছে..."
    );


    const response =
      await fetch(
        `${API_BASE_URL}/owner/activate`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...getAPIHeaders()
          },

          body:
            JSON.stringify({
              activation_code:
                activationCode
            }),

          cache:
            "no-store"
        }
      );


    let data =
      null;


    try {

      data =
        await response.json();

    } catch (jsonError) {

      data =
        null;

    }


    if (!response.ok) {

      let message =
        "Owner activation failed.";


      if (
        data &&
        data.detail
      ) {

        if (
          typeof data.detail ===
          "string"
        ) {

          message =
            data.detail;

        } else if (
          data.detail.message
        ) {

          message =
            data.detail.message;

        }

      }


      showLockMessage(
        message
      );


      return;

    }


    clearLockMessage();


    showToast(
      "👑 Owner Access সফলভাবে চালু হয়েছে।"
    );


    await loadScanStatus();


    updateDashboard();


    /*
      Owner Access successful হলে
      app unlock হবে।
    */

    unlockApplication();


  } catch (error) {

    console.error(
      "Owner activation error:",
      error
    );


    showLockMessage(
      "Server-এর সাথে যোগাযোগ করা যাচ্ছে না। Backend চালু আছে কি না দেখুন।"
    );

  }

}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(
  pageName
) {

  document
    .querySelectorAll(".page")
    .forEach(
      page => {

        page.classList.remove(
          "active-page"
        );

      }
    );


  const page =
    document.getElementById(
      `${pageName}Page`
    );


  if (page) {

    page.classList.add(
      "active-page"
    );

  }


  document
    .querySelectorAll(".nav-item")
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
            pageName
        );

      }
    );


  const sidebar =
    document.querySelector(
      ".sidebar"
    );


  if (sidebar) {

    sidebar.classList.remove(
      "mobile-open"
    );

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (
    pageName ===
    "dashboard"
  ) {

    updateDashboard();

  }


  if (
    pageName ===
    "history"
  ) {

    renderHistory();

  }


  if (
    pageName ===
    "scanner"
  ) {

    loadScanStatus();

  }


  if (
    pageName ===
    "health"
  ) {

    updateHealthNumbers(
      getProfile()
    );

  }

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function toggleSidebar() {

  const sidebar =
    document.querySelector(
      ".sidebar"
    );


  if (sidebar) {

    sidebar.classList.toggle(
      "mobile-open"
    );

  }

}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

function previewFoodImage(
  event
) {

  const input =
    event.target;


  const file =
    input &&
    input.files
      ? input.files[0]
      : null;


  if (!file) {

    return;

  }


  if (
    !file.type ||
    !file.type.startsWith(
      "image/"
    )
  ) {

    showToast(
      "অনুগ্রহ করে একটি image file নির্বাচন করুন।"
    );


    input.value = "";

    return;

  }


  if (
    file.size >
    10 * 1024 * 1024
  ) {

    showToast(
      "ছবির size 10 MB-এর বেশি হতে পারবে না।"
    );


    input.value = "";

    return;

  }


  selectedImageFile =
    file;


  const reader =
    new FileReader();


  reader.onload =
    function(
      readerEvent
    ) {

      selectedImageData =
        readerEvent.target.result;


      const preview =
        document.getElementById(
          "foodPreview"
        );


      if (preview) {

        preview.src =
          selectedImageData;

      }


      const uploadBox =
        document.getElementById(
          "uploadBox"
        );


      if (uploadBox) {

        uploadBox.classList.add(
          "hidden"
        );

      }


      const previewContainer =
        document.getElementById(
          "imagePreviewContainer"
        );


      if (previewContainer) {

        previewContainer.classList.remove(
          "hidden"
        );

      }


      const analyzeButton =
        document.getElementById(
          "analyzeBtn"
        );


      if (analyzeButton) {

        analyzeButton.classList.remove(
          "hidden"
        );


        analyzeButton.disabled =
          false;


        analyzeButton.textContent =
          "✨ AI দিয়ে বিশ্লেষণ করুন";

      }


      showToast(
        "ছবি প্রস্তুত। এখন AI দিয়ে বিশ্লেষণ করতে পারেন।"
      );

    };


  reader.onerror =
    function() {

      selectedImageFile =
        null;


      selectedImageData =
        null;


      input.value = "";


      showToast(
        "ছবিটি পড়া যায়নি। আবার চেষ্টা করুন।"
      );

    };


  reader.readAsDataURL(
    file
  );

}


/* =========================================================
   REMOVE IMAGE
========================================================= */

function removeFoodImage() {

  selectedImageData =
    null;


  selectedImageFile =
    null;


  const input =
    document.getElementById(
      "foodImage"
    );


  if (input) {

    input.value = "";

  }


  const preview =
    document.getElementById(
      "foodPreview"
    );


  if (preview) {

    preview.removeAttribute(
      "src"
    );

  }


  const previewContainer =
    document.getElementById(
      "imagePreviewContainer"
    );


  if (previewContainer) {

    previewContainer.classList.add(
      "hidden"
    );

  }


  const analyzeButton =
    document.getElementById(
      "analyzeBtn"
    );


  if (analyzeButton) {

    analyzeButton.classList.add(
      "hidden"
    );


    analyzeButton.disabled =
      false;


    analyzeButton.textContent =
      "✨ AI দিয়ে বিশ্লেষণ করুন";

  }


  const result =
    document.getElementById(
      "analysisResult"
    );


  if (result) {

    result.innerHTML =
      getEmptyAnalysisHTML();

  }


  const uploadBox =
    document.getElementById(
      "uploadBox"
    );


  if (uploadBox) {

    uploadBox.classList.remove(
      "hidden"
    );

  }

}


/* =========================================================
   EMPTY ANALYSIS
========================================================= */

function getEmptyAnalysisHTML() {

  return `

    <div class="empty-result">

      <div>
        🥘
      </div>

      <h2>
        Nutrition Result
      </h2>

      <p>
        একটি খাবারের ছবি upload করলে
        AI analysis এখানে দেখা যাবে।
      </p>

    </div>

  `;

}


/* =========================================================
   SCAN STATUS
========================================================= */

async function loadScanStatus() {

  try {

    const response =
      await fetch(
        `${API_BASE_URL}/scan-status`,
        {
          method:
            "GET",

          headers:
            getAPIHeaders(),

          cache:
            "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    const status =
      await response.json();


    currentScanStatus =
      status;


    updateScanStatusUI(
      status
    );


  } catch (error) {

    console.error(
      "Scan status error:",
      error
    );


    currentScanStatus =
      null;


    updateScanStatusUnavailable();

  }

}


/* =========================================================
   SCAN STATUS UNAVAILABLE
========================================================= */

function updateScanStatusUnavailable() {

  let element =
    document.getElementById(
      "aiScanStatus"
    );


  if (!element) {

    element =
      createScanStatusElement();

  }


  if (!element) {

    return;

  }


  element.innerHTML = `

    <span>
      AI Scan Status:
    </span>

    <strong>
      সংযোগ পাওয়া যাচ্ছে না
    </strong>

  `;


  element.classList.add(
    "status-error"
  );


  element.classList.remove(
    "status-success"
  );


  element.classList.remove(
    "status-warning"
  );

}


/* =========================================================
   CREATE SCAN STATUS ELEMENT
========================================================= */

function createScanStatusElement() {

  let element =
    document.getElementById(
      "aiScanStatus"
    );


  if (element) {

    return element;

  }


  const scannerPage =
    document.getElementById(
      "scannerPage"
    );


  if (!scannerPage) {

    return null;

  }


  element =
    document.createElement(
      "div"
    );


  element.id =
    "aiScanStatus";


  element.className =
    "scan-status";


  const uploadBox =
    document.getElementById(
      "uploadBox"
    );


  if (
    uploadBox &&
    uploadBox.parentNode
  ) {

    uploadBox.parentNode.insertBefore(
      element,
      uploadBox
    );

  } else {

    scannerPage.prepend(
      element
    );

  }


  return element;

}


/* =========================================================
   SCAN STATUS UI
========================================================= */

function updateScanStatusUI(
  status
) {

  if (!status) {

    updateScanStatusUnavailable();

    return;

  }


  const element =
    createScanStatusElement();


  if (!element) {

    return;

  }


  const plan =
    String(
      status.plan ||
      "free"
    ).toLowerCase();


  const rawRemaining =
    Number(
      status.remaining
    );


  const remaining =
    Number.isFinite(
      rawRemaining
    )
      ? Math.max(
          rawRemaining,
          0
        )
      : 0;


  const limit =
    Number(
      status.limit
    );


  /*
    OWNER
  */

  if (
    plan ===
    "owner"
  ) {

    element.innerHTML = `

      <span>
        FoodLens Plan:
      </span>

      <strong>
        👑 Owner — Unlimited
      </strong>

    `;


    element.classList.remove(
      "status-error",
      "status-warning"
    );


    element.classList.add(
      "status-success"
    );


    return;

  }


  /*
    PREMIUM
  */

  if (
    plan ===
    "premium"
  ) {

    if (
      Number.isFinite(
        limit
      ) &&
      limit > 0
    ) {

      element.innerHTML = `

        <span>
          FoodLens Premium:
        </span>

        <strong>
          ${remaining}
        </strong>

        <span>
          / ${limit} AI Scan বাকি
        </span>

      `;

    } else {

      element.innerHTML = `

        <span>
          FoodLens Plan:
        </span>

        <strong>
          ⭐ Premium
        </strong>

      `;

    }


    element.classList.remove(
      "status-error",
      "status-warning"
    );


    element.classList.add(
      "status-success"
    );


    return;

  }


  /*
    FREE
  */

  element.innerHTML = `

    <span>
      আজকের Free AI Scan:
    </span>

    <strong>
      ${remaining}
    </strong>

    <span>
      / ${
        Number.isFinite(limit)
          ? limit
          : FREE_SCAN_LIMIT
      } বাকি
    </span>

  `;


  element.classList.remove(
    "status-error",
    "status-success"
  );


  if (
    remaining <= 0
  ) {

    element.classList.add(
      "status-warning"
    );

  } else {

    element.classList.add(
      "status-success"
    );

  }

}


/* =========================================================
   REAL AI FOOD ANALYSIS
========================================================= */

async function analyzeFood() {

  if (isAnalyzing) {

    return;

  }


  if (!selectedImageFile) {

    showToast(
      "আগে একটি খাবারের ছবি নির্বাচন করুন।"
    );

    return;

  }


  const button =
    document.getElementById(
      "analyzeBtn"
    );


  isAnalyzing =
    true;


  if (button) {

    button.disabled =
      true;


    button.textContent =
      "🤖 AI বিশ্লেষণ করছে...";

  }


  try {

    /*
      STEP 1:
      Check server-side scan status.
    */

    const statusResponse =
      await fetch(
        `${API_BASE_URL}/scan-status`,
        {
          method:
            "GET",

          headers:
            getAPIHeaders(),

          cache:
            "no-store"
        }
      );


    if (!statusResponse.ok) {

      throw new Error(
        "AI Scan limit check করা যাচ্ছে না। Backend চালু আছে কি না দেখুন।"
      );

    }


    const status =
      await statusResponse.json();


    currentScanStatus =
      status;


    updateScanStatusUI(
      status
    );


    /*
      STEP 2:
      Determine current plan.

      IMPORTANT:
      Owner = Unlimited.

      তাই Owner-এর ক্ষেত্রে
      remaining 0 হলেও scan block হবে না।
    */

    const currentPlan =
      String(
        status.plan ||
        "free"
      ).toLowerCase();


    const isOwner =
      currentPlan ===
      "owner";


    /*
      STEP 3:
      Check scan availability.

      Owner হলে এই limit check
      সম্পূর্ণভাবে skip হবে।
    */

    if (!isOwner) {

      const remaining =
        Number(
          status.remaining
        );


      const noScanRemaining =
        Number.isFinite(
          remaining
        ) &&
        remaining <= 0;


      if (
        status.can_scan === false ||
        noScanRemaining
      ) {

        showDailyLimitPopup(
          Number(
            status.limit
          ) ||
          (
            currentPlan ===
            "premium"
              ? 50
              : FREE_SCAN_LIMIT
          ),
          currentPlan
        );


        return;

      }

    }


    /*
      STEP 4:
      Prepare image.
    */

    const formData =
      new FormData();


    formData.append(
      "file",
      selectedImageFile
    );


    /*
      STEP 5:
      Send image to backend.
    */

    const response =
      await fetch(
        `${API_BASE_URL}/analyze-food`,
        {
          method:
            "POST",

          headers:
            getAPIHeaders(),

          body:
            formData
        }
      );


    let data =
      null;


    try {

      data =
        await response.json();

    } catch (jsonError) {

      data =
        null;

    }


    /*
      DAILY LIMIT

      Owner-এর ক্ষেত্রে backend থেকে
      429 আসার কথা নয়।

      তারপরও যদি আসে, Owner-কে
      Free limit popup দেখানো হবে না।
    */

    if (
      response.status ===
      429
    ) {

      if (isOwner) {

        showToast(
          "⚠️ Owner Access আছে, কিন্তু server scan limit response দিয়েছে। Backend status check করুন।"
        );


        await loadScanStatus();

        return;

      }


      const detail =
        data &&
        data.detail;


      const limit =
        detail &&
        typeof detail ===
          "object"

          ? Number(
              detail.limit
            ) ||
            (
              currentPlan ===
              "premium"
                ? 50
                : FREE_SCAN_LIMIT
            )

          : (
              currentPlan ===
              "premium"
                ? 50
                : FREE_SCAN_LIMIT
            );


      const popupPlan =
        detail &&
        typeof detail ===
          "object" &&
        detail.plan

          ? String(
              detail.plan
            ).toLowerCase()

          : currentPlan;


      showDailyLimitPopup(
        limit,
        popupPlan
      );


      await loadScanStatus();

      return;

    }


    /*
      BACKEND ERROR
    */

    if (!response.ok) {

      let errorMessage =
        "AI analysis failed.";


      if (
        data &&
        data.detail
      ) {

        if (
          typeof data.detail ===
          "string"
        ) {

          errorMessage =
            data.detail;

        } else if (
          data.detail.message
        ) {

          errorMessage =
            data.detail.message;

        }

      }


      throw new Error(
        errorMessage
      );

    }


    /*
      VALIDATE AI RESPONSE
    */

    if (
      !data ||
      data.success === false
    ) {

      throw new Error(
        "AI এই ছবিটি বিশ্লেষণ করতে পারেনি।"
      );

    }


    /*
      DISPLAY RESULT
    */

    displayAnalysisResult(
      data
    );


    /*
      SAVE HISTORY
    */

    await saveAIScan(
      data
    );


    /*
      UPDATE SCAN STATUS
    */

    if (
      data.scan &&
      !isOwner
    ) {

      currentScanStatus = {

        limit:
          data.scan.limit,

        used:
          data.scan.used,

        remaining:
          data.scan.remaining,

        can_scan:
          data.scan.remaining > 0,

        plan:
          data.scan.plan ||
          currentPlan ||
          "free"

      };


      updateScanStatusUI(
        currentScanStatus
      );

    } else {

      /*
        Owner-এর ক্ষেত্রে backend
        status আবার load করব।

        এতে UI-তে সবসময়
        👑 Owner — Unlimited
        দেখা থাকবে।
      */

      await loadScanStatus();

    }


    /*
      SUCCESS MESSAGE
    */

    showToast(
      isOwner
        ? "👑 Owner AI food analysis সম্পন্ন হয়েছে।"
        : "খাবারের AI analysis সম্পন্ন হয়েছে।"
    );


  } catch (error) {

    console.error(
      "AI analysis error:",
      error
    );


    showToast(
      error.message ||
      "AI analysis ব্যর্থ হয়েছে। আবার চেষ্টা করুন।"
    );


  } finally {

    isAnalyzing =
      false;


    if (button) {

      button.disabled =
        false;


      if (
        selectedImageFile
      ) {

        button.textContent =
          "✨ আবার Analyze করুন";

      } else {

        button.textContent =
          "✨ AI দিয়ে বিশ্লেষণ করুন";

      }

    }

  }

}


/* =========================================================
   DISPLAY AI RESULT
========================================================= */

function displayAnalysisResult(
  data
) {

  const result =
    document.getElementById(
      "analysisResult"
    );


  if (!result) {

    return;

  }


  const mealName =
    data.meal_name ||
    "Food Analysis";


  const confidence =
    normalizeConfidence(
      data.confidence
    );


  const total =
    data.total ||
    {};


  const items =
    Array.isArray(
      data.items
    )
      ? data.items
      : [];


  const calories =
    safeNumber(
      total.calories
    );


  const protein =
    safeNumber(
      total.protein_g
    );


  const carbs =
    safeNumber(
      total.carbs_g
    );


  const fat =
    safeNumber(
      total.fat_g
    );


  const fiber =
    safeNumber(
      total.fiber_g
    );


  const itemHTML =
    items.length > 0

      ? `

        <div class="ai-food-items">

          <div class="section-label">
            Detected Foods
          </div>

          ${items
            .map(
              item => {

                const itemName =
                  escapeHTML(
                    item.name ||
                    "Food item"
                  );


                const portion =
                  escapeHTML(
                    item.portion ||
                    "আনুমানিক portion"
                  );


                const itemCalories =
                  safeNumber(
                    item.calories
                  );


                const itemProtein =
                  safeNumber(
                    item.protein_g
                  );


                const itemCarbs =
                  safeNumber(
                    item.carbs_g
                  );


                const itemFat =
                  safeNumber(
                    item.fat_g
                  );


                return `

                  <div class="ai-food-item">

                    <div>

                      <strong>
                        ${itemName}
                      </strong>

                      <div class="ai-food-portion">
                        ${portion}
                      </div>

                    </div>


                    <div class="ai-food-nutrition">

                      <strong>
                        ${itemCalories} kcal
                      </strong>

                      <span>
                        P ${itemProtein}g
                        · C ${itemCarbs}g
                        · F ${itemFat}g
                      </span>

                    </div>

                  </div>

                `;

              }
            )
            .join("")}

        </div>

      `

      : "";


  const notes =
    data.notes

      ? escapeHTML(
          data.notes
        )

      : "এই nutrition values ছবির ভিত্তিতে AI-এর আনুমানিক হিসাব।";


  result.innerHTML = `

    <div class="analysis-result">

      <div class="result-title">

        <div>

          <span class="eyebrow">
            AI ANALYSIS RESULT
          </span>

          <h2>
            ${escapeHTML(
              mealName
            )}
          </h2>

        </div>


        <span class="demo-label">
          AI
        </span>

      </div>


      <div class="ai-confidence">

        AI confidence:
        ${confidence}%

      </div>


      <div class="nutrition-main">

        <span>
          আনুমানিক Calories
        </span>

        <strong>
          ${calories}
        </strong>

        <small>
          kcal
        </small>

      </div>


      <div class="nutrition-grid">

        <div class="nutrition-item">

          <span>
            Protein
          </span>

          <strong>
            ${protein} g
          </strong>

        </div>


        <div class="nutrition-item">

          <span>
            Carbs
          </span>

          <strong>
            ${carbs} g
          </strong>

        </div>


        <div class="nutrition-item">

          <span>
            Fat
          </span>

          <strong>
            ${fat} g
          </strong>

        </div>


        <div class="nutrition-item">

          <span>
            Fiber
          </span>

          <strong>
            ${fiber} g
          </strong>

        </div>

      </div>


      ${itemHTML}


      <div class="ai-note">

        <strong>
          AI Note:
        </strong>

        ${notes}

      </div>


      <div class="ai-disclaimer">

        Nutrition values আনুমানিক।
        Ingredients, রান্নার পদ্ধতি এবং portion size-এর কারণে
        প্রকৃত values আলাদা হতে পারে।

      </div>

    </div>

  `;

}


/* =========================================================
   SAVE AI SCAN
========================================================= */

async function saveAIScan(
  data
) {

  const history =
    getHistory();


  const total =
    data.total ||
    {};


  let historyImage =
    selectedImageData;


  try {

    if (
      selectedImageData
    ) {

      historyImage =
        await createHistoryThumbnail(
          selectedImageData
        );

    }

  } catch (error) {

    console.warn(
      "Thumbnail creation failed:",
      error
    );

  }


  const scan = {

    id:
      Date.now(),

    name:
      data.meal_name ||
      "Food Analysis",

    calories:
      safeNumber(
        total.calories
      ),

    protein:
      safeNumber(
        total.protein_g
      ),

    carbs:
      safeNumber(
        total.carbs_g
      ),

    fat:
      safeNumber(
        total.fat_g
      ),

    fiber:
      safeNumber(
        total.fiber_g
      ),

    image:
      historyImage,

    date:
      new Date().toISOString(),

    confidence:
      normalizeConfidence(
        data.confidence
      ),

    items:
      Array.isArray(
        data.items
      )
        ? data.items
        : [],

    notes:
      data.notes ||
      ""

  };


  history.unshift(
    scan
  );


  const limitedHistory =
    history.slice(
      0,
      MAX_HISTORY_ITEMS
    );


  try {

    localStorage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify(
        limitedHistory
      )
    );

  } catch (error) {

    console.error(
      "History save error:",
      error
    );


    try {

      const compactHistory =
        limitedHistory.map(
          item => ({

            ...item,

            image:
              null

          })
        );


      localStorage.setItem(
        STORAGE_KEYS.history,
        JSON.stringify(
          compactHistory
        )
      );


      showToast(
        "Scan হয়েছে। Device storage কম থাকায় image history ছাড়া save হয়েছে।"
      );

    } catch (secondError) {

      console.error(
        "Compact history save error:",
        secondError
      );


      showToast(
        "Scan হয়েছে, কিন্তু device storage কম থাকায় history save করা যায়নি।"
      );

    }

  }


  updateDashboard();

  renderHistory();

}


/* =========================================================
   CREATE HISTORY THUMBNAIL
========================================================= */

function createHistoryThumbnail(
  dataURL
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();


      image.onload =
        function() {

          let width =
            image.width;


          let height =
            image.height;


          const max =
            HISTORY_IMAGE_MAX_SIZE;


          if (
            width >
            height
          ) {

            if (
              width >
              max
            ) {

              height =
                Math.round(
                  height *
                  (
                    max /
                    width
                  )
                );


              width =
                max;

            }

          } else {

            if (
              height >
              max
            ) {

              width =
                Math.round(
                  width *
                  (
                    max /
                    height
                  )
                );


              height =
                max;

            }

          }


          const canvas =
            document.createElement(
              "canvas"
            );


          canvas.width =
            width;


          canvas.height =
            height;


          const context =
            canvas.getContext(
              "2d"
            );


          if (!context) {

            reject(
              new Error(
                "Canvas unavailable."
              )
            );

            return;

          }


          context.drawImage(
            image,
            0,
            0,
            width,
            height
          );


          resolve(
            canvas.toDataURL(
              "image/jpeg",
              0.62
            )
          );

        };


      image.onerror =
        function() {

          reject(
            new Error(
              "Image loading failed."
            )
          );

        };


      image.src =
        dataURL;

    }
  );

}


/* =========================================================
   HISTORY
========================================================= */

function getHistory() {

  try {

    const saved =
      localStorage.getItem(
        STORAGE_KEYS.history
      );


    if (!saved) {

      return [];

    }


    const parsed =
      JSON.parse(
        saved
      );


    return Array.isArray(
      parsed
    )
      ? parsed
      : [];

  } catch (error) {

    console.error(
      "History loading error:",
      error
    );


    return [];

  }

}


/* =========================================================
   RENDER HISTORY
========================================================= */

function renderHistory() {

  const container =
    document.getElementById(
      "historyList"
    );


  if (!container) {

    return;

  }


  const history =
    getHistory();


  if (
    history.length ===
    0
  ) {

    container.innerHTML = `

      <div class="empty-list">

        এখনো কোনো food scan নেই।

        <br>

        আপনার প্রথম meal scan দিয়ে শুরু করুন।

      </div>

    `;


    return;

  }


  container.innerHTML =
    history
      .map(
        scan => {

          const image =
            scan.image ||
            createPlaceholderImage();


          return `

            <div class="history-item">

              <img
                src="${image}"
                alt="${escapeHTML(
                  scan.name ||
                  "Food"
                )}"
                loading="lazy"
              >


              <div class="history-info">

                <h3>
                  ${escapeHTML(
                    scan.name ||
                    "Food Analysis"
                  )}
                </h3>


                <p>

                  ${formatDate(
                    scan.date
                  )}

                  · Protein
                  ${safeNumber(
                    scan.protein
                  )}g

                  · Carbs
                  ${safeNumber(
                    scan.carbs
                  )}g

                  · Fat
                  ${safeNumber(
                    scan.fat
                  )}g

                </p>

              </div>


              <div class="history-calories">

                ${safeNumber(
                  scan.calories
                )}

                kcal

              </div>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   CLEAR HISTORY
========================================================= */

function clearHistory() {

  const history =
    getHistory();


  if (
    history.length ===
    0
  ) {

    showToast(
      "History এখনো empty।"
    );

    return;

  }


  const confirmed =
    window.confirm(
      "আপনি কি সব scan history delete করতে চান?"
    );


  if (!confirmed) {

    return;

  }


  localStorage.removeItem(
    STORAGE_KEYS.history
  );


  renderHistory();

  updateDashboard();


  showToast(
    "Scan history clear করা হয়েছে।"
  );

}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard() {

  const profile =
    getProfile();


  const history =
    getHistory();


  const today =
    getTodayScans(
      history
    );


  const totals =
    today.reduce(
      (
        sum,
        item
      ) => {

        sum.calories +=
          safeNumber(
            item.calories
          );


        sum.protein +=
          safeNumber(
            item.protein
          );


        sum.carbs +=
          safeNumber(
            item.carbs
          );


        sum.fat +=
          safeNumber(
            item.fat
          );


        return sum;

      },
      {

        calories:
          0,

        protein:
          0,

        carbs:
          0,

        fat:
          0

      }
    );


  setText(
    "todayCalories",
    Math.round(
      totals.calories
    )
  );


  setText(
    "todayProtein",
    Math.round(
      totals.protein
    )
  );


  setText(
    "todayCarbs",
    Math.round(
      totals.carbs
    )
  );


  setText(
    "todayFat",
    Math.round(
      totals.fat
    )
  );


  setText(
    "dashboardName",
    profile.name ||
    "there"
  );


  const target =
    calculateDailyCalories(
      profile
    );


  setText(
    "targetCalories",
    target ||
    2000
  );


  setText(
    "circleCalories",
    Math.round(
      totals.calories
    )
  );


  updateCalorieCircle(
    totals.calories,
    target ||
    2000
  );


  updateGoalBadge(
    profile.goal ||
    "maintain"
  );


  updateHealthSummary(
    profile
  );


  renderRecentFood(
    history.slice(
      0,
      5
    )
  );

}


/* =========================================================
   TODAY'S SCANS
========================================================= */

function getTodayScans(
  history
) {

  const today =
    new Date();


  return history.filter(
    item => {

      const scanDate =
        new Date(
          item.date
        );


      if (
        Number.isNaN(
          scanDate.getTime()
        )
      ) {

        return false;

      }


      return (

        scanDate.getFullYear() ===
        today.getFullYear()

        &&

        scanDate.getMonth() ===
        today.getMonth()

        &&

        scanDate.getDate() ===
        today.getDate()

      );

    }
  );

}


/* =========================================================
   CALORIE CIRCLE
========================================================= */

function updateCalorieCircle(
  calories,
  target
) {

  const circle =
    document.getElementById(
      "calorieCircle"
    );


  if (!circle) {

    return;

  }


  const safeCalories =
    Math.max(
      Number(calories) || 0,
      0
    );


  const safeTarget =
    Number(target) > 0
      ? Number(target)
      : 2000;


  const percentage =
    Math.min(
      safeCalories /
        safeTarget,
      1
    );


  const degrees =
    percentage *
    360;


  circle.style.background = `

    conic-gradient(

      var(--green)
      ${degrees}deg,

      rgba(255,255,255,0.06)
      ${degrees}deg

    )

  `;


  const message =
    document.getElementById(
      "calorieMessage"
    );


  if (!message) {

    return;

  }


  if (
    safeCalories ===
    0
  ) {

    message.textContent =
      "আপনার meal scan করে আজকের calorie intake track করুন.";

  } else if (
    safeCalories <
    safeTarget *
      0.75
  ) {

    message.textContent =
      "আপনি আপনার estimated daily target-এর দিকে এগোচ্ছেন.";

  } else if (
    safeCalories <=
    safeTarget
  ) {

    message.textContent =
      "আপনার recorded intake এখন estimated daily target-এর মধ্যে আছে.";

  } else {

    message.textContent =
      "আপনার recorded intake estimated daily target-এর চেয়ে বেশি.";

  }

}


/* =========================================================
   GOAL BADGE
========================================================= */

function updateGoalBadge(
  goal
) {

  const labels = {

    lose:
      "Lose Weight",

    maintain:
      "Maintain",

    gain:
      "Gain Weight"

  };


  setText(
    "goalBadge",
    labels[goal] ||
    "Maintain"
  );

}


/* =========================================================
   RECENT FOOD
========================================================= */

function renderRecentFood(
  history
) {

  const container =
    document.getElementById(
      "recentFoodList"
    );


  if (!container) {

    return;

  }


  if (
    history.length ===
    0
  ) {

    container.innerHTML = `

      <div class="empty-list">

        এখনো কোনো recent food scan নেই।

      </div>

    `;


    return;

  }


  container.innerHTML =
    history
      .map(
        item => {

          return `

            <div class="food-item">

              <img
                class="food-thumb"
                src="${
                  item.image ||
                  createPlaceholderImage()
                }"
                alt="${escapeHTML(
                  item.name ||
                  "Food"
                )}"
                loading="lazy"
              >


              <div class="food-info">

                <strong>
                  ${escapeHTML(
                    item.name ||
                    "Food Analysis"
                  )}
                </strong>


                <span>
                  ${formatDate(
                    item.date
                  )}
                </span>

              </div>


              <div class="food-calories">

                ${safeNumber(
                  item.calories
                )}

                kcal

              </div>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   PROFILE
========================================================= */

function getProfile() {

  try {

    const saved =
      localStorage.getItem(
        STORAGE_KEYS.profile
      );


    if (!saved) {

      return {};

    }


    const parsed =
      JSON.parse(
        saved
      );


    return (
      parsed &&
      typeof parsed ===
        "object"
    )
      ? parsed
      : {};

  } catch (error) {

    console.error(
      "Profile loading error:",
      error
    );


    return {};

  }

}


/* =========================================================
   LOAD PROFILE
========================================================= */

function loadProfile() {

  const profile =
    getProfile();


  setInputValue(
    "profileName",
    profile.name
  );


  setInputValue(
    "profileAge",
    profile.age
  );


  setInputValue(
    "profileGender",
    profile.gender
  );


  setInputValue(
    "profileHeight",
    profile.height
  );


  setInputValue(
    "profileWeight",
    profile.weight
  );


  setInputValue(
    "profileActivity",
    profile.activity ||
    "1.2"
  );


  const goal =
    profile.goal ||
    "maintain";


  const goalRadio =
    document.querySelector(
      `input[name="goal"][value="${goal}"]`
    );


  if (goalRadio) {

    goalRadio.checked =
      true;

  }


  updateHealthNumbers(
    profile
  );

}


/* =========================================================
   SAVE HEALTH PROFILE
========================================================= */

function saveHealthProfile(
  event
) {

  if (event) {

    event.preventDefault();

  }


  const goalElement =
    document.querySelector(
      'input[name="goal"]:checked'
    );


  const getValue =
    id => {

      const element =
        document.getElementById(
          id
        );


      return element
        ? element.value
        : "";

    };


  const profile = {

    name:
      getValue(
        "profileName"
      ).trim(),


    age:
      Number(
        getValue(
          "profileAge"
        )
      ) || 0,


    gender:
      getValue(
        "profileGender"
      ),


    height:
      Number(
        getValue(
          "profileHeight"
        )
      ) || 0,


    weight:
      Number(
        getValue(
          "profileWeight"
        )
      ) || 0,


    activity:
      Number(
        getValue(
          "profileActivity"
        )
      ) || 1.2,


    goal:
      goalElement
        ? goalElement.value
        : "maintain"

  };


  try {

    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify(
        profile
      )
    );

  } catch (error) {

    console.error(
      "Profile save error:",
      error
    );


    showToast(
      "Profile save করা যায়নি। Device storage check করুন।"
    );


    return;

  }


  updateHealthNumbers(
    profile
  );


  updateDashboard();


  showToast(
    "Health profile সফলভাবে save হয়েছে।"
  );

}


/* =========================================================
   BMI
========================================================= */

function calculateBMI(
  profile
) {

  const height =
    Number(
      profile.height
    );


  const weight =
    Number(
      profile.weight
    );


  if (
    !height ||
    !weight ||
    height <= 0 ||
    weight <= 0
  ) {

    return null;

  }


  const meters =
    height / 100;


  return (
    weight /
    (
      meters *
      meters
    )
  );

}


/* =========================================================
   DAILY CALORIES
========================================================= */

function calculateDailyCalories(
  profile
) {

  const age =
    Number(
      profile.age
    );


  const weight =
    Number(
      profile.weight
    );


  const height =
    Number(
      profile.height
    );


  const activity =
    Number(
      profile.activity
    ) || 1.2;


  if (
    !age ||
    !weight ||
    !height
  ) {

    return null;

  }


  let bmr;


  if (
    profile.gender ===
    "female"
  ) {

    bmr =
      10 *
        weight +

      6.25 *
        height -

      5 *
        age -

      161;

  } else {

    bmr =
      10 *
        weight +

      6.25 *
        height -

      5 *
        age +

      5;

  }


  let calories =
    bmr *
    activity;


  if (
    profile.goal ===
    "lose"
  ) {

    calories -=
      300;

  } else if (
    profile.goal ===
    "gain"
  ) {

    calories +=
      300;

  }


  return Math.max(
    1000,
    Math.round(
      calories
    )
  );

}


/* =========================================================
   HEALTH NUMBERS
========================================================= */

function updateHealthNumbers(
  profile
) {

  const bmi =
    calculateBMI(
      profile
    );


  const calories =
    calculateDailyCalories(
      profile
    );


  if (bmi) {

    setText(
      "healthBMI",
      bmi.toFixed(1)
    );


    setText(
      "bmiStatus",
      getBMIStatus(
        bmi
      )
    );

  } else {

    setText(
      "healthBMI",
      "—"
    );


    setText(
      "bmiStatus",
      "আপনার তথ্য যোগ করুন"
    );

  }


  setText(
    "healthCalories",
    calories
      ? calories
      : "—"
  );

}


/* =========================================================
   HEALTH SUMMARY
========================================================= */

function updateHealthSummary(
  profile
) {

  setText(
    "summaryAge",
    profile.age
      ? `${profile.age} years`
      : "—"
  );


  setText(
    "summaryHeight",
    profile.height
      ? `${profile.height} cm`
      : "—"
  );


  setText(
    "summaryWeight",
    profile.weight
      ? `${profile.weight} kg`
      : "—"
  );


  const bmi =
    calculateBMI(
      profile
    );


  setText(
    "summaryBMI",
    bmi
      ? bmi.toFixed(1)
      : "—"
  );

}


/* =========================================================
   BMI STATUS
========================================================= */

function getBMIStatus(
  bmi
) {

  if (
    bmi <
    18.5
  ) {

    return "সাধারণ adult BMI range-এর নিচে";

  }


  if (
    bmi <
    25
  ) {

    return "সাধারণ adult BMI range-এর মধ্যে";

  }


  if (
    bmi <
    30
  ) {

    return "সাধারণ adult BMI range-এর উপরে";

  }


  return "BMI 30 বা তার বেশি";

}


/* =========================================================
   DAILY LIMIT POPUP
========================================================= */

function showDailyLimitPopup(
  limit = FREE_SCAN_LIMIT,
  plan = "free"
) {

  /*
    IMPORTANT:
    Owner-এর জন্য কখনো daily limit popup
    দেখানো যাবে না।
  */

  const currentPlan =
    String(
      plan ||
      "free"
    ).toLowerCase();


  if (
    currentPlan ===
    "owner"
  ) {

    return;

  }


  const existing =
    document.getElementById(
      "foodLensLimitPopup"
    );


  if (existing) {

    existing.remove();

  }


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "foodLensLimitPopup";


  overlay.className =
    "foodlens-popup-overlay";


  /*
    Premium হলে Premium wording,
    Free হলে Free wording।
  */

  const isPremium =
    currentPlan ===
    "premium";


  const planName =
    isPremium
      ? "Premium"
      : "Free";


  const tomorrowLimit =
    Number(limit) ||
    (
      isPremium
        ? 50
        : FREE_SCAN_LIMIT
    );


  overlay.innerHTML = `

    <div class="foodlens-popup-card">

      <div class="foodlens-popup-icon">
        ⭐
      </div>


      <h2>
        আজকের AI Scan শেষ
      </h2>


      <p>

        আপনি আজকের
        ${escapeHTML(
          String(tomorrowLimit)
        )}টি
        ${planName}
        AI Scan
        ব্যবহার করে ফেলেছেন।

        <br><br>

        আগামীকাল আবার
        ${escapeHTML(
          String(tomorrowLimit)
        )}টি
        ${planName}
        Scan
        পাবেন।

      </p>


      ${
        isPremium
          ? `

            <div class="foodlens-popup-info">

              আজকের Premium AI Scan limit শেষ হয়েছে।

            </div>

          `
          : `

            <div class="foodlens-popup-info">

              আরও বেশি AI Scan ব্যবহার করতে
              FoodLens Premium সম্পর্কে জানতে পারেন।

            </div>

          `
      }


      ${
        isPremium
          ? ""

          : `

            <button
              id="foodLensUpgradeButton"
              type="button"
              class="primary-btn full-btn"
            >
              ⭐ Premium সম্পর্কে জানুন
            </button>

          `
      }


      <button
        id="foodLensCloseLimitButton"
        type="button"
        class="text-btn popup-close-btn"
      >
        পরে করব
      </button>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  const closeButton =
    document.getElementById(
      "foodLensCloseLimitButton"
    );


  if (closeButton) {

    closeButton.addEventListener(
      "click",
      () => {

        overlay.remove();

      }
    );

  }


  const upgradeButton =
    document.getElementById(
      "foodLensUpgradeButton"
    );


  if (upgradeButton) {

    upgradeButton.addEventListener(
      "click",
      () => {

        overlay.remove();

        showPremiumInfo();

      }
    );

  }


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        overlay
      ) {

        overlay.remove();

      }

    }
  );

}


/* =========================================================
   PREMIUM INFO
========================================================= */

function showPremiumInfo() {

  const existing =
    document.getElementById(
      "foodLensPremiumPopup"
    );


  if (existing) {

    existing.remove();

  }


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "foodLensPremiumPopup";


  overlay.className =
    "foodlens-popup-overlay";


  overlay.innerHTML = `

    <div class="foodlens-popup-card premium-popup">

      <div class="foodlens-popup-icon">
        ⭐
      </div>


      <h2>
        FoodLens Premium
      </h2>


      <p>

        আরও বেশি AI-powered food analysis
        ব্যবহারের জন্য Premium plan।

      </p>


      <div class="premium-feature-list">

        <div>
          ✓ বেশি AI Scan access
        </div>


        <div>
          ✓ FoodLens-এর আরও সুবিধা
        </div>


        <div>
          ✓ ভবিষ্যতের Premium features
        </div>

      </div>


      <div class="foodlens-popup-info">

        Premium activation এখন manualভাবে
        করা হবে।

        <br><br>

        Premium নিতে WhatsApp-এ যোগাযোগ করুন:
        <strong>01710888092</strong>

        <br><br>

        <button
          id="foodLensWhatsAppButton"
          type="button"
          class="primary-btn full-btn"
        >
          💬 WhatsApp-এ মেসেজ করুন
        </button>

      </div>


      <button
        id="foodLensPremiumClose"
        type="button"
        class="primary-btn full-btn"
      >
        ঠিক আছে
      </button>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  const whatsappButton =
    document.getElementById(
      "foodLensWhatsAppButton"
    );


  if (whatsappButton) {

    whatsappButton.addEventListener(
      "click",
      () => {

        const phone =
          "8801710888092";


        const message =
          "Hello, I want to get FoodLens Premium.";


        const whatsappURL =
          `https://wa.me/${phone}?text=${encodeURIComponent(
            message
          )}`;


        window.open(
          whatsappURL,
          "_blank"
        );

      }
    );

  }


  const closeButton =
    document.getElementById(
      "foodLensPremiumClose"
    );


  if (closeButton) {

    closeButton.addEventListener(
      "click",
      () => {

        overlay.remove();

      }
    );

  }


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        overlay
      ) {

        overlay.remove();

      }

    }
  );

}


/* =========================================================
   SAFE NUMBER
========================================================= */

function safeNumber(
  value
) {

  const number =
    Number(
      value
    );


  if (
    Number.isFinite(
      number
    )
  ) {

    return Math.round(
      number
    );

  }


  return 0;

}


/* =========================================================
   CONFIDENCE
========================================================= */

function normalizeConfidence(
  value
) {

  let confidence =
    Number(
      value
    );


  if (
    !Number.isFinite(
      confidence
    )
  ) {

    return 0;

  }


  if (
    confidence > 0 &&
    confidence <= 1
  ) {

    confidence *=
      100;

  }


  confidence =
    Math.max(
      0,
      Math.min(
        confidence,
        100
      )
    );


  return Math.round(
    confidence
  );

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;

  }

}


/* =========================================================
   SET INPUT
========================================================= */

function setInputValue(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (
    element &&
    value !== undefined &&
    value !== null
  ) {

    element.value =
      value;

  }

}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(
  dateString
) {

  const date =
    new Date(
      dateString
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "Unknown date";

  }


  return date.toLocaleString(
    "bn-BD",
    {

      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit"

    }
  );

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
  message
) {

  const toast =
    document.getElementById(
      "toast"
    );


  if (!toast) {

    return;

  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    window.foodLensToastTimer
  );


  window.foodLensToastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      3200
    );

}


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHTML(
  value
) {

  return String(
    value
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   PLACEHOLDER IMAGE
========================================================= */

function createPlaceholderImage() {

  return (

    "data:image/svg+xml;charset=UTF-8," +

    encodeURIComponent(`

      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="200"
        height="200"
        viewBox="0 0 200 200"
      >

        <rect
          width="200"
          height="200"
          fill="#13251f"
        />

        <text
          x="100"
          y="110"
          text-anchor="middle"
          font-size="60"
        >
          🥘
        </text>

      </svg>

    `)

  );

}


/* =========================================================
   KEYBOARD SUPPORT
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key !==
      "Enter"
    ) {

      return;

    }


    const lockScreen =
      document.getElementById(
        "lockScreen"
      );


    if (!lockScreen) {

      return;

    }


    const lockVisible =
      !lockScreen
        .classList
        .contains(
          "hidden"
        );


    if (!lockVisible) {

      return;

    }


    const setupArea =
      document.getElementById(
        "setupPasswordArea"
      );


    const setupVisible =
      setupArea &&
      !setupArea
        .classList
        .contains(
          "hidden"
        );


    if (setupVisible) {

      createPassword();

    } else {

      unlockApp();

    }

  }
);


/* =========================================================
   GLOBAL ERROR PROTECTION
========================================================= */

window.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "FoodLens unhandled error:",
      event.reason
    );

  }
);