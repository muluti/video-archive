import React, { useState, useEffect } from "react";
import { auth, db, storage } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import "./styles.css";

const COLORS = { coral: "#FF6B52", bg: "#F8F9FA", text: "#2C3E50", gray: "#95A5A6", lightGray: "#ECF0F1" };
const PREDEFINED_TAGS = ["일상", "여행", "공부", "운동", "작업", "영감", "숏폼", "기록"];

export default function App() {
  const [init, setInit] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNewAccount, setIsNewAccount] = useState(false);

  const [viewMode, setViewMode] = useState("gallery");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [videos, setVideos] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentCategory, setCurrentCategory] = useState({ type: "all", tag: null });
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);

  // 선택된 비디오 및 편집 상태
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState([]);
  const [editMemo, setEditMemo] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setInit(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVideos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  const onAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isNewAccount) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) { alert(error.message); }
  };

  const onUpload = async () => {
    if (files.length === 0) return alert("동영상을 선택해주세요!");
    setUploading(true);
    try {
      for (const file of files) {
        const filePath = `videos/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        const result = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(result.ref);

        await addDoc(collection(db, "videos"), {
          url,
          fileName: file.name,
          title: "", // 초기 제목은 공백
          filePath,
          createdAt: serverTimestamp(),
          tags: [],
          memo: ""
        });
      }
      setFiles([]); setViewMode("gallery");
    } catch (error) { alert("업로드 실패: " + error.message); }
    finally { setUploading(false); }
  };

  const onVideoClick = (vid) => {
    setSelectedVideo(vid);
    setEditTitle(vid.title || "");
    setEditTags(vid.tags || []);
    setEditMemo(vid.memo || "");
    setIsSheetOpen(false); // 처음 누르면 재생 화면만 뜸
  };

  const closeVideoModal = () => {
    setSelectedVideo(null);
    setIsSheetOpen(false);
  };

  const toggleTag = (tag) => {
    if (editTags.includes(tag)) setEditTags(editTags.filter(t => t !== tag));
    else setEditTags([...editTags, tag]);
  };

  const onSaveDetails = async () => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "videos", selectedVideo.id), {
        title: editTitle,
        tags: editTags,
        memo: editMemo
      });
      alert("저장되었습니다.");
      setIsSheetOpen(false);
    } catch (error) {
      alert("저장 실패: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const onDeleteClick = async () => {
    if (window.confirm("정말 이 영상을 영구 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, "videos", selectedVideo.id));
        await deleteObject(ref(storage, selectedVideo.filePath)).catch(e => console.log(e));
        closeVideoModal();
      } catch (error) { alert("삭제 실패: " + error.message); }
    }
  };

  const filteredVideos = videos.filter((vid) => {
    let tagMatch = currentCategory.tag ? vid.tags?.includes(currentCategory.tag) : true;
    let searchMatch = searchKeyword ? (vid.memo?.toLowerCase().includes(searchKeyword.toLowerCase()) || vid.tags?.some(t => t.includes(searchKeyword)) || vid.title?.toLowerCase().includes(searchKeyword.toLowerCase())) : true;
    return tagMatch && searchMatch;
  });

  if (!init) return <div style={{ padding: "20px", textAlign: "center", color: COLORS.coral }}>Loading...</div>;

  return (
    <div style={{ backgroundColor: "#e9ecef", minHeight: "100vh", display: "flex", justifyContent: "center", fontFamily: 'sans-serif' }}>
      <div style={{ width: "100%", maxWidth: "480px", backgroundColor: COLORS.bg, position: "relative", minHeight: "100vh", boxShadow: "0 0 20px rgba(0,0,0,0.1)", overflow: "hidden" }}>

        {isLoggedIn ? (
          <>
            <div style={{ padding: "30px 20px", paddingBottom: "100px", height: "100%", overflowY: "auto" }}>
              {viewMode === "gallery" ? (
                <div>
                  <h1 style={{ fontSize: "28px", fontWeight: "900", color: COLORS.text, marginBottom: "5px", letterSpacing: "-0.5px" }}>
                    {currentCategory.tag ? `#${currentCategory.tag}` : "Video Archive"}
                  </h1>
                  <p style={{ color: COLORS.gray, fontSize: "14px", marginBottom: "20px" }}>{filteredVideos.length}개의 영상 기록</p>

                  <input
                    type="text" placeholder="🔍 제목, 태그, 메모 검색"
                    value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
                    style={{ width: "100%", padding: "14px 20px", borderRadius: "20px", border: "none", backgroundColor: COLORS.lightGray, marginBottom: "20px", boxSizing: "border-box", fontSize: "15px", outline: "none", color: COLORS.text, fontWeight: "500" }}
                  />

                  {filteredVideos.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px", color: COLORS.gray, fontWeight: "bold" }}>분류에 해당하는 영상이 없습니다.</div>
                  )}

                  {/* 비디오 그리드 (핀터레스트 스타일 모방) */}
                  <div style={{ columnCount: 2, columnGap: "15px" }}>
                    {filteredVideos.map((vid) => (
                      <div key={vid.id} onClick={() => onVideoClick(vid)}
                        style={{ breakInside: "avoid", marginBottom: "15px", position: "relative", borderRadius: "16px", overflow: "hidden", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.05)", backgroundColor: "#000" }}>
                        <video src={vid.url} preload="metadata" style={{ width: "100%", maxHeight: "250px", objectFit: "cover", display: "block" }} />

                        {/* 썸네일 위 플레이 아이콘 */}
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: "50%", width: "40px", height: "40px", display: "flex", justifyContent: "center", alignItems: "center", color: "white" }}>
                          <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" /></svg>
                        </div>

                        {/* 태그 표시 */}
                        {vid.tags && vid.tags.length > 0 && (
                          <div style={{ position: "absolute", bottom: "10px", left: "10px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {vid.tags.slice(0, 2).map((tag, idx) => (
                              <span key={idx} style={{ backgroundColor: idx === 0 ? COLORS.coral : "rgba(255,255,255,0.9)", color: idx === 0 ? "white" : COLORS.text, padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 style={{ color: COLORS.text, marginBottom: "20px" }}>Upload Video</h2>
                  <div style={{ padding: "40px 20px", backgroundColor: "#fff", border: `2px dashed ${COLORS.gray}`, borderRadius: "20px", textAlign: "center" }}>
                    <input type="file" accept="video/mp4,video/x-m4v,video/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} style={{ margin: "20px 0" }} />
                    <button onClick={onUpload} disabled={uploading || files.length === 0} style={{ padding: "16px", backgroundColor: uploading ? COLORS.gray : COLORS.coral, color: "white", border: "none", borderRadius: "15px", cursor: uploading ? "not-allowed" : "pointer", fontWeight: "bold", width: "100%", fontSize: "16px" }}>
                      {uploading ? "업로드 중..." : "클라우드에 저장"}
                    </button>
                    <button onClick={() => setViewMode("gallery")} style={{ width: "100%", marginTop: "15px", background: "none", border: "none", color: COLORS.gray, fontWeight: "bold", cursor: "pointer" }}>취소</button>
                  </div>
                </div>
              )}
            </div>

            {/* 메인 화면 하단 플로팅 메뉴 버튼 */}
            <button
              onClick={() => setIsMenuModalOpen(true)}
              style={{ position: "fixed", bottom: "30px", right: "max(30px, calc(50% - 210px))", width: "65px", height: "65px", backgroundColor: COLORS.coral, color: "white", border: "none", borderRadius: "50%", boxShadow: "0 8px 25px rgba(255, 107, 82, 0.5)", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 900 }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>

            {/* 통합 메뉴 모달창 */}
            <div style={{ position: "fixed", bottom: 0, left: 0, width: "100%", display: "flex", justifyContent: "center", zIndex: 1000, transition: "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)", transform: isMenuModalOpen ? "translateY(0)" : "translateY(100%)", visibility: isMenuModalOpen ? "visible" : "hidden" }}>
              <div style={{ width: "100%", maxWidth: "480px", backgroundColor: "#fff", borderTopLeftRadius: "30px", borderTopRightRadius: "30px", padding: "30px", boxSizing: "border-box", boxShadow: "0 -10px 30px rgba(0,0,0,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
                  <h3 style={{ margin: 0, color: COLORS.text, fontWeight: "900", fontSize: "22px" }}>Menu</h3>
                  <button onClick={() => setIsMenuModalOpen(false)} style={{ background: "none", border: "none", color: COLORS.gray, fontSize: "22px", fontWeight: "bold", cursor: "pointer" }}>✕</button>
                </div>

                <div style={{ display: "flex", gap: "10px", marginBottom: "30px" }}>
                  <button onClick={() => { setViewMode("upload"); setIsMenuModalOpen(false); }} style={{ flex: 1, padding: "14px", borderRadius: "16px", border: "none", backgroundColor: COLORS.text, color: "white", fontWeight: "bold", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontSize: "15px" }}>
                    새 영상 올리기
                  </button>
                  <button onClick={() => { if (window.confirm('로그아웃 하시겠습니까?')) signOut(auth); }} style={{ padding: "14px 20px", borderRadius: "16px", border: `1px solid ${COLORS.lightGray}`, backgroundColor: "white", color: COLORS.gray, fontWeight: "bold", cursor: "pointer" }}>
                    로그아웃
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: "14px", fontWeight: "800", color: COLORS.gray, display: "block", marginBottom: "12px" }}>태그별 모아보기</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button onClick={() => { setCurrentCategory({ type: 'all', tag: null }); setIsMenuModalOpen(false); }} style={{ padding: "10px 18px", borderRadius: "20px", border: "none", backgroundColor: !currentCategory.tag ? COLORS.coral : COLORS.lightGray, color: !currentCategory.tag ? "white" : COLORS.text, fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>전체 보기</button>
                    {PREDEFINED_TAGS.map(tag => (
                      <button key={tag} onClick={() => { setCurrentCategory({ type: 'all', tag }); setIsMenuModalOpen(false); }} style={{ padding: "10px 18px", borderRadius: "20px", border: "none", backgroundColor: currentCategory.tag === tag ? COLORS.coral : COLORS.lightGray, color: currentCategory.tag === tag ? "white" : COLORS.text, fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
                        # {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {isMenuModalOpen && <div onClick={() => setIsMenuModalOpen(false)} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999, backdropFilter: "blur(2px)" }} />}

            {/* ============================================================== */}
            {/* 비디오 재생 화면 & Overview 패널 (사용자가 요청한 핵심 로직) */}
            {/* ============================================================== */}
            {selectedVideo && (
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "black", zIndex: 2000, display: "flex", justifyContent: "center", overflow: "hidden" }}>
                <div style={{ width: "100%", maxWidth: "480px", height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>

                  {/* 영상 재생 화면의 상단 타이틀 바 */}
                  <div style={{ position: "absolute", top: 0, width: "100%", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box", zIndex: 2010, background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}>
                    <h2 style={{ color: "white", margin: 0, fontSize: "18px", fontWeight: "600", textShadow: "0 2px 4px rgba(0,0,0,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80%" }}>
                      {selectedVideo.title || "제목 없는 영상"}
                    </h2>
                    {!isSheetOpen && (
                      <button onClick={closeVideoModal} style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "none", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    )}
                  </div>

                  {/* 비디오 플레이어 */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                    <video src={selectedVideo.url} controls autoPlay preload="auto" style={{ width: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  </div>

                  {/* 하단 Overview 호출 버튼 */}
                  {!isSheetOpen && (
                    <div onClick={() => setIsSheetOpen(true)} style={{ position: "absolute", bottom: 0, width: "100%", padding: "30px 0", textAlign: "center", background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)", color: "white", fontWeight: "bold", fontSize: "16px", cursor: "pointer", zIndex: 2005 }}>
                      Overview <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" style={{ marginLeft: "5px", verticalAlign: "middle" }}><polyline points="18 15 12 9 6 15"></polyline></svg>
                    </div>
                  )}

                  {/* 하단 Overview 바텀 시트 */}
                  <div style={{ position: "absolute", bottom: 0, width: "100%", backgroundColor: "#fff", borderTopLeftRadius: "30px", borderTopRightRadius: "30px", padding: "30px", paddingBottom: "50px", boxSizing: "border-box", zIndex: 2006, transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)", transform: isSheetOpen ? "translateY(0)" : "translateY(100%)", maxHeight: "80vh", overflowY: "auto" }}>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", marginTop: "-10px" }}>
                      <div style={{ backgroundColor: COLORS.coral, color: "white", padding: "6px 16px", borderRadius: "20px", fontWeight: "bold", fontSize: "14px" }}>Overview</div>
                      <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                        <button onClick={onDeleteClick} style={{ background: "none", border: "none", cursor: "pointer" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.gray} strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                        <button onClick={() => setIsSheetOpen(false)} style={{ background: "none", border: "none", color: COLORS.text, fontSize: "18px", fontWeight: "bold", cursor: "pointer" }}>✕</button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
                      {/* 제목 수정 */}
                      <div>
                        <label style={{ fontSize: "13px", fontWeight: "800", color: COLORS.gray, display: "block", marginBottom: "8px" }}>Title</label>
                        <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="영상의 제목을 입력하세요" style={{ width: "100%", padding: "14px", border: "none", backgroundColor: COLORS.lightGray, borderRadius: "12px", boxSizing: "border-box", color: COLORS.text, fontWeight: "bold", fontSize: "15px" }} />
                      </div>

                      {/* 태그 수정 */}
                      <div>
                        <label style={{ fontSize: "13px", fontWeight: "800", color: COLORS.gray, display: "block", marginBottom: "10px" }}>Tags (복수 선택 가능)</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {PREDEFINED_TAGS.map(tag => {
                            const isSelected = editTags.includes(tag);
                            return (
                              <button key={tag} onClick={() => toggleTag(tag)} style={{ padding: "8px 16px", borderRadius: "20px", border: isSelected ? `2px solid ${COLORS.coral}` : "2px solid transparent", backgroundColor: isSelected ? "white" : COLORS.lightGray, color: isSelected ? COLORS.coral : COLORS.gray, fontWeight: "bold", cursor: "pointer", fontSize: "13px", transition: "all 0.2s" }}>
                                {isSelected && <span style={{ marginRight: "4px" }}>✓</span>} {tag}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* 메모 수정 */}
                      <div>
                        <label style={{ fontSize: "13px", fontWeight: "800", color: COLORS.gray, display: "block", marginBottom: "5px" }}>Description</label>
                        <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} placeholder="이 영상에 대한 기록을 남겨보세요." style={{ width: "100%", padding: "14px", border: "none", backgroundColor: COLORS.lightGray, borderRadius: "12px", height: "100px", resize: "none", boxSizing: "border-box", color: COLORS.text, lineHeight: "1.5" }} />
                      </div>

                      {/* 저장 버튼 */}
                      <button onClick={onSaveDetails} disabled={isUpdating} style={{ padding: "16px", backgroundColor: COLORS.text, color: "white", border: "none", borderRadius: "15px", cursor: "pointer", fontWeight: "bold", marginTop: "10px", fontSize: "16px", boxShadow: "0 4px 15px rgba(0,0,0,0.15)" }}>
                        {isUpdating ? "저장 중..." : "변경사항 저장"}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px", backgroundColor: COLORS.bg, height: "100vh", boxSizing: "border-box" }}>
            <h1 style={{ color: COLORS.text, fontSize: "32px", fontWeight: "900", marginBottom: "10px" }}>Welcome<br />Archive.</h1>
            <p style={{ color: COLORS.gray, marginBottom: "40px" }}>Video Inspiration is here.</p>
            <form onSubmit={onAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input name="email" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: "16px", borderRadius: "15px", border: "none", backgroundColor: COLORS.lightGray, fontSize: "15px" }} />
              <input name="password" type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "16px", borderRadius: "15px", border: "none", backgroundColor: COLORS.lightGray, fontSize: "15px" }} />
              <button type="submit" style={{ padding: "16px", backgroundColor: COLORS.coral, color: "white", border: "none", borderRadius: "15px", cursor: "pointer", fontWeight: "bold", fontSize: "16px", marginTop: "10px" }}>{isNewAccount ? "계정 생성" : "로그인"}</button>
            </form>
            <button onClick={() => setIsNewAccount(!isNewAccount)} style={{ marginTop: "20px", background: "none", border: "none", color: COLORS.gray, cursor: "pointer", fontWeight: "bold" }}>{isNewAccount ? "로그인하기" : "계정 만들기"}</button>
          </div>
        )}
      </div>
    </div>
  );
}