#include <iostream>
#include <string>
#include <curl/curl.h>

size_t getAnswerFunction(void* ptr, size_t size, size_t nmemb, void* data) {
    ((std::string*)data)->append((char*)ptr, size * nmemb);
    return size * nmemb;
}
CURL *curl = nullptr;
struct curl_slist *headers = nullptr;
bool safeCall(const CURLcode &value) {
    if (value == CURLE_OK) return true;
    if (headers != nullptr)curl_slist_free_all(headers);
    if (curl != nullptr) curl_easy_cleanup(curl);
    curl = nullptr;
    headers = nullptr;
    return false;
}
std::string post(const std::string &url, const std::string &data) {
    curl = curl_easy_init();
    if (curl == nullptr) {
        std::cout << "curl_easy_init() failed.\n";
        return "";
    }
    headers = curl_slist_append(headers, "Accept: application/text");
    headers = curl_slist_append(headers, "Content-Type: application/json");
    if(!safeCall(curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers))) return "";
    if(!safeCall(curl_easy_setopt(curl, CURLOPT_URL, url.c_str()))) return "";
    if(!safeCall(curl_easy_setopt(curl, CURLOPT_POST, 1L))) return "";
    if(!safeCall(curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, data.size()))) return "";
    if(!safeCall(curl_easy_setopt(curl, CURLOPT_POSTFIELDS, data.c_str()))) return "";
    
    std::string res_string;
    if(!safeCall(curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, getAnswerFunction))) return "";
    if(!safeCall(curl_easy_setopt(curl, CURLOPT_WRITEDATA, &res_string))) return "";

    // Perform the request, res gets the return code
    CURLcode res = curl_easy_perform(curl);
    if(res != CURLE_OK) {
        std::cout << "curl_easy_perform() failed:\n" << std::string(curl_easy_strerror(res)) << '\n';
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        curl = nullptr;
        headers = nullptr;
        return "";
    }

    int http_code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
    if (http_code != 200) return "";
    //std::cout << res_string << '\n';
    // cleanup
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    curl = nullptr;
    headers = nullptr;
    return res_string;
}

#include <windows.h>
#include <vector>
#include <sstream>

const std::string self = "{ \"name\": \"cppDevice\", \"functions\": [ { \"name\": \"function\", \"overloads\": [{ \"visible\": true, \"parameters\": [], \"returnType\": \"None\" }] } ] }";
void start() {
    const std::string connectionKey = post("http://localhost:80/connect", self);
    if (connectionKey == "Invalid") { std::cout << "Received Invalid message" << std::endl; return; }
    std::string cmds = "";
    while (true) {
        Sleep(1000);
        cmds = post("http://localhost:80/keepAlive", "{ \"id\": \"" + connectionKey + "\" }");
        if (cmds == "") continue;
        if (cmds == "Invalid") break;
        std::string reply = "{ \"id\": \"" + connectionKey + "\", \"values\": [";
        size_t index = 0;
        std::string tmp;
        for (size_t i = 0; i <= cmds.size(); i++) {
            if ((cmds[i] != '\n') && (i != cmds.size())) { tmp.push_back(cmds[i]); continue; }
            //std::cout << "Cmd#" << (index + 1) << ": " << tmp << '\n';
            if (index == 0) reply += "null"; else reply += ", null";
            index++;
        }
        reply += "] }";
        if (post("http://localhost:80/return", reply) == "Invalid") break;
    }
    std::cout << "Received Invalid message" << std::endl;
}
int main() {
    curl_global_init(CURL_GLOBAL_ALL);

    while(true) {
        start();
    }

    curl_global_cleanup();
    return 0;
}